package com.vedixsolutions.pos;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The Android half of the web app's HardwareBridge contract.
 *
 * The web app flattens every print payload to HTML before calling this, so the
 * only job here is to put that HTML through Android's print pipeline — the
 * WebView has no window.print() of its own.
 */
@CapacitorPlugin(name = "Hardware")
public class HardwarePlugin extends Plugin {

    // Printing is asynchronous and the adapter reads from this WebView after
    // the method returns, so it has to outlive the call or it gets collected
    // mid-job and the spooler fails.
    private WebView printWebView;

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
                                printWebView = null;
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
}
