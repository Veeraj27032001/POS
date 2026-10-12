package com.vedixsolutions.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The Android half of the web app's HardwareBridge.
 *
 * Which printer a till uses is per-device, not per-build — the web app stores
 * the choice and passes it in on every call, so one APK serves every client
 * whether they run Bluetooth, USB or a network printer.
 */
@CapacitorPlugin(
    name = "Hardware",
    permissions = {
        @Permission(alias = HardwarePlugin.BLUETOOTH, strings = {
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_SCAN
        })
    }
)
public class HardwarePlugin extends Plugin {

    static final String BLUETOOTH = "bluetooth";

    // Standard Serial Port Profile — what ESC/POS printers expose.
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int NETWORK_TIMEOUT_MS = 8000;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private WebView printWebView;

    /* ---------------- Full-page documents: Android's own print pipeline ---- */

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html");
        if (html == null || html.trim().isEmpty()) {
            call.reject("Nothing to print.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = new WebView(getContext());
                webView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        try {
                            PrintManager printManager =
                                (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                            if (printManager == null) {
                                call.reject("Printing isn't available on this device.");
                                return;
                            }
                            String jobName = "Vedix POS document";
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                            printManager.print(jobName, adapter, new PrintAttributes.Builder().build());
                            call.resolve();
                        } catch (Exception e) {
                            call.reject("Failed to start the print job.", e);
                        } finally {
                            printWebView = null;
                        }
                    }
                });
                printWebView = webView;
                webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                printWebView = null;
                call.reject("Failed to prepare the document for printing.", e);
            }
        });
    }

    /* ---------------- Raw ESC/POS: the actual till printer ----------------- */

    @PluginMethod
    public void printBytes(PluginCall call) {
        String transport = call.getString("transport", "bluetooth");
        if ("bluetooth".equals(transport) && needsBluetoothPermission()) {
            bridge.saveCall(call);
            requestPermissionForAlias(BLUETOOTH, call, "bluetoothPermsCallback");
            return;
        }
        dispatchWrite(call);
    }

    @PermissionCallback
    private void bluetoothPermsCallback(PluginCall call) {
        if (getPermissionState(BLUETOOTH) != PermissionState.GRANTED) {
            call.reject("Bluetooth permission is needed to reach the printer.");
            return;
        }
        dispatchWrite(call);
    }

    private void dispatchWrite(PluginCall call) {
        final String transport = call.getString("transport", "bluetooth");
        final String data = call.getString("data");
        if (data == null) {
            call.reject("No print data supplied.");
            return;
        }

        final byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Print data was not valid base64.", e);
            return;
        }

        final String address = call.getString("address");
        final int port = call.getInt("port", 9100);

        io.execute(() -> {
            try {
                switch (transport) {
                    case "network":
                        writeNetwork(address, port, bytes);
                        break;
                    case "usb":
                        writeUsb(address, bytes);
                        break;
                    default:
                        writeBluetooth(address, bytes);
                        break;
                }
                call.resolve();
            } catch (Exception e) {
                String message = e.getMessage();
                call.reject(message == null ? "Could not reach the printer." : message, e);
            }
        });
    }

    private void writeBluetooth(String address, byte[] bytes) throws Exception {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) throw new IllegalStateException("This device has no Bluetooth.");
        if (!adapter.isEnabled()) throw new IllegalStateException("Bluetooth is switched off.");
        if (address == null) throw new IllegalStateException("No Bluetooth printer selected.");

        BluetoothDevice device = adapter.getRemoteDevice(address);
        BluetoothSocket socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            adapter.cancelDiscovery();
            socket.connect();
            OutputStream out = socket.getOutputStream();
            out.write(bytes);
            out.flush();
            // The socket closing before the printer has drained its buffer
            // truncates the receipt, so give it a moment.
            Thread.sleep(400);
        } finally {
            try {
                socket.close();
            } catch (Exception ignored) {
                // Already gone — nothing useful to do.
            }
        }
    }

    private void writeNetwork(String address, int port, byte[] bytes) throws Exception {
        if (address == null) throw new IllegalStateException("No printer address set.");
        Socket socket = new Socket();
        try {
            socket.connect(new InetSocketAddress(address, port), NETWORK_TIMEOUT_MS);
            OutputStream out = socket.getOutputStream();
            out.write(bytes);
            out.flush();
        } finally {
            try {
                socket.close();
            } catch (Exception ignored) {
                // Already gone — nothing useful to do.
            }
        }
    }

    private void writeUsb(String deviceName, byte[] bytes) throws Exception {
        UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
        if (manager == null) throw new IllegalStateException("USB isn't available on this device.");

        UsbDevice device = null;
        for (UsbDevice candidate : manager.getDeviceList().values()) {
            if (deviceName == null || deviceName.equals(candidate.getDeviceName())) {
                device = candidate;
                break;
            }
        }
        if (device == null) throw new IllegalStateException("The USB printer isn't connected.");
        if (!manager.hasPermission(device)) {
            throw new IllegalStateException(
                "USB permission not granted — reconnect the printer and allow access.");
        }

        UsbInterface printerInterface = null;
        UsbEndpoint output = null;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface candidate = device.getInterface(i);
            for (int e = 0; e < candidate.getEndpointCount(); e++) {
                UsbEndpoint endpoint = candidate.getEndpoint(e);
                if (endpoint.getDirection() == UsbConstants.USB_DIR_OUT
                    && endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                    printerInterface = candidate;
                    output = endpoint;
                    break;
                }
            }
            if (output != null) break;
        }
        if (output == null) throw new IllegalStateException("That USB device isn't a printer.");

        UsbDeviceConnection connection = manager.openDevice(device);
        if (connection == null) throw new IllegalStateException("Could not open the USB printer.");
        try {
            connection.claimInterface(printerInterface, true);
            int sent = connection.bulkTransfer(output, bytes, bytes.length, 5000);
            if (sent < 0) throw new IllegalStateException("The USB printer rejected the data.");
        } finally {
            connection.releaseInterface(printerInterface);
            connection.close();
        }
    }

    /* ---------------- Discovery, so the user can pick a printer ----------- */

    @PluginMethod
    public void listPrinters(PluginCall call) {
        String transport = call.getString("transport", "bluetooth");
        if ("bluetooth".equals(transport) && needsBluetoothPermission()) {
            bridge.saveCall(call);
            requestPermissionForAlias(BLUETOOTH, call, "listPermsCallback");
            return;
        }
        resolvePrinterList(call, transport);
    }

    @PermissionCallback
    private void listPermsCallback(PluginCall call) {
        if (getPermissionState(BLUETOOTH) != PermissionState.GRANTED) {
            call.reject("Bluetooth permission is needed to list printers.");
            return;
        }
        resolvePrinterList(call, call.getString("transport", "bluetooth"));
    }

    private void resolvePrinterList(PluginCall call, String transport) {
        JSArray printers = new JSArray();
        try {
            if ("usb".equals(transport)) {
                UsbManager manager = (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
                if (manager != null) {
                    for (UsbDevice device : manager.getDeviceList().values()) {
                        JSObject item = new JSObject();
                        item.put("address", device.getDeviceName());
                        String label = device.getProductName();
                        item.put("name", label == null ? device.getDeviceName() : label);
                        printers.put(item);
                    }
                }
            } else {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    call.reject("This device has no Bluetooth.");
                    return;
                }
                if (!adapter.isEnabled()) {
                    call.reject("Bluetooth is switched off.");
                    return;
                }
                for (BluetoothDevice device : adapter.getBondedDevices()) {
                    JSObject item = new JSObject();
                    item.put("address", device.getAddress());
                    item.put("name", device.getName() == null ? device.getAddress() : device.getName());
                    printers.put(item);
                }
            }
        } catch (SecurityException e) {
            call.reject("Permission to list devices was refused.", e);
            return;
        }

        JSObject result = new JSObject();
        result.put("printers", printers);
        call.resolve(result);
    }

    private boolean needsBluetoothPermission() {
        // The runtime Bluetooth permissions only exist from Android 12.
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            && getPermissionState(BLUETOOTH) != PermissionState.GRANTED;
    }
}
