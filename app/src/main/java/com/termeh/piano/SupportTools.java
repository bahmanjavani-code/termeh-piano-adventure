package com.termeh.piano;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Parent-directed support and minimum-version policy.
 *
 * No errors or child data are uploaded automatically. The report requires
 * a parent to review and send an email in their own mail app.
 *
 * The version-policy endpoint is HTTPS and does not receive device identifiers.
 * An update blocks ONLY when a verified store URL is available; a cached policy
 * remains enforceable offline after it has been fetched successfully.
 */
final class SupportTools {
    private static final String PREFS = "termeh_support_v1";
    private static final String POLICY_URL =
            "https://raw.githubusercontent.com/bahmanjavani-code/termeh-piano-adventure/main/config/android-update.json";
    // Populate after the developer provides a dedicated support email.
    private static final String SUPPORT_EMAIL = "";
    private static final long CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L;
    private static boolean nativeCrashRecorderInstalled = false;

    private final Activity activity;
    private final SharedPreferences prefs;
    private final Handler main = new Handler(Looper.getMainLooper());
    private AlertDialog mandatoryDialog;
    private volatile boolean loading;

    SupportTools(Activity activity) {
        this.activity = activity;
        this.prefs = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
    }

    private int installedVersion() {
        try {
            return activity.getPackageManager().getPackageInfo(
                    activity.getPackageName(), 0).versionCode;
        } catch (Exception ignored) {
            return 0;
        }
    }

    private String installedVersionName() {
        try {
            return activity.getPackageManager().getPackageInfo(
                    activity.getPackageName(), 0).versionName;
        } catch (Exception ignored) {
            return "unknown";
        }
    }

    static synchronized void installNativeCrashRecorder(Activity activity) {
        if (nativeCrashRecorderInstalled) return;
        nativeCrashRecorderInstalled = true;
        final SharedPreferences storage = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
        final Thread.UncaughtExceptionHandler previous =
                Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, problem) -> {
            try {
                String type = problem == null ? "Unknown" :
                        problem.getClass().getSimpleName();
                StackTraceElement first = problem != null && problem.getStackTrace().length > 0
                        ? problem.getStackTrace()[0] : null;
                String location = first == null ? "unknown" :
                        first.getClassName() + ":" + first.getLineNumber();
                storage.edit().putString("last_native_error",
                        "native_exception " + limit(type, 50) + " " + limit(location, 120))
                        .commit();
            } catch (Exception ignored) { }
            if (previous != null) {
                previous.uncaughtException(thread, problem);
            } else {
                android.os.Process.killProcess(android.os.Process.myPid());
                System.exit(1);
            }
        });
    }

    void recordWebError(int line) {
        prefs.edit().putString("last_native_error", "webview_console_error index.html:" + line)
                .apply();
    }

    void recordRendererCrash() {
        prefs.edit().putString("last_native_error", "webview_renderer_exited").apply();
    }

    static String limit(String value, int max) {
        if (value == null) return "";
        return value.substring(0, Math.min(value.length(), max));
    }

    void composeEmail(String eventSummary) {
        // Only crash categories, line numbers and Android API are included.
        // Do not include stacks, raw messages, user input, account or child information.
        String report = "Termeh Piano — parent-submitted error report\n"
                + "Version: " + installedVersionName() + " (" + installedVersion() + ")\n"
                + "Android API: " + Build.VERSION.SDK_INT + "\n"
                + "Native event: " + prefs.getString("last_native_error", "none") + "\n"
                + "Web events: " + limit(eventSummary, 1200) + "\n\n"
                + "Please describe what happened (do not add children's personal data):\n";
        Intent email = new Intent(Intent.ACTION_SENDTO);
        email.setData(Uri.parse("mailto:"));
        if (!SUPPORT_EMAIL.isEmpty())
            email.putExtra(Intent.EXTRA_EMAIL, new String[]{SUPPORT_EMAIL});
        email.putExtra(Intent.EXTRA_SUBJECT, "Termeh Piano error report v" + installedVersionName());
        email.putExtra(Intent.EXTRA_TEXT, report);
        try {
            activity.startActivity(Intent.createChooser(email,
                    "Choose email app / انتخاب ایمیل"));
        } catch (ActivityNotFoundException ex) {
            new AlertDialog.Builder(activity)
                    .setMessage("Email application not available. / برنامه ایمیل پیدا نشد.")
                    .setPositiveButton("OK", null).show();
        }
    }

    private boolean validStoreUrl(String url) {
        if (url == null || url.isEmpty()) return false;
        Uri uri = Uri.parse(url);
        if (!"https".equals(uri.getScheme())) return false;
        if (!"cafebazaar.ir".equals(uri.getHost())) return false;
        return ("/app/" + activity.getPackageName()).equals(uri.getPath());
    }

    void openStore(String url) {
        if (!validStoreUrl(url)) return;
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        try {
            activity.startActivity(intent);
        } catch (ActivityNotFoundException ex) {
            Toast.makeText(activity, "Store app unavailable / فروشگاه در دسترس نیست",
                    Toast.LENGTH_LONG).show();
        }
    }

    /** Enforce a previously downloaded update requirement, including offline. */
    void enforceCachedPolicy() {
        int minimum = prefs.getInt("minimum_version", 0);
        String store = prefs.getString("store_url", "");
        if (minimum > installedVersion() && validStoreUrl(store)) {
            showMandatoryUpdate(store);
        }
    }

    private void showMandatoryUpdate(String store) {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        if (mandatoryDialog != null && mandatoryDialog.isShowing()) return;
        mandatoryDialog = new AlertDialog.Builder(activity)
                .setTitle("به‌روزرسانی ضروری / Update required")
                .setMessage("برای ادامه استفاده، نسخه جدید Termeh Piano را از کافه‌بازار نصب کنید. "
                        + "پیشرفت موجود پاک نمی‌شود.\n"
                        + "To continue, please install the latest version from Cafe Bazaar.")
                .setCancelable(false)
                .setPositiveButton("به‌روزرسانی / Update", (d, w) -> openStore(store))
                .create();
        mandatoryDialog.setCanceledOnTouchOutside(false);
        mandatoryDialog.show();
        // Do not allow the dialog's positive button to dismiss the required-update gate.
        mandatoryDialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> openStore(store));
    }

    void checkUpdates(boolean fromParent) {
        if (loading) return;
        if (!fromParent) {
            long last = prefs.getLong("last_check_ms", 0);
            if (System.currentTimeMillis() - last < CHECK_INTERVAL_MS) {
                enforceCachedPolicy();
                return;
            }
        }
        loading = true;
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(POLICY_URL).openConnection();
                conn.setConnectTimeout(4500);
                conn.setReadTimeout(4500);
                conn.setUseCaches(false);
                conn.setInstanceFollowRedirects(false);
                if (conn.getResponseCode() != 200) throw new Exception("Policy unavailable");
                StringBuilder body = new StringBuilder();
                try (BufferedReader br = new BufferedReader(new InputStreamReader(
                        conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = br.readLine()) != null && body.length() < 8192)
                        body.append(line);
                }
                if (body.length() > 8192) throw new Exception("Policy too large");
                JSONObject policy = new JSONObject(body.toString());
                if (policy.optInt("schema") != 1) throw new Exception("Invalid schema");
                int minimum = policy.getInt("minimumVersionCode");
                int latest = policy.getInt("latestVersionCode");
                String store = policy.optString("storeUrl", "");
                if (minimum < 0 || minimum > 1000000 ||
                        latest < minimum || latest > 1000000)
                    throw new Exception("Invalid version code");
                // Discard policies containing an untrusted destination.
                if (!store.isEmpty() && !validStoreUrl(store))
                    throw new Exception("Untrusted store destination");

                prefs.edit().putInt("minimum_version", minimum)
                        .putInt("latest_version", latest)
                        .putString("store_url", store)
                        .putLong("last_check_ms", System.currentTimeMillis())
                        .apply();
                final boolean required = minimum > installedVersion() && validStoreUrl(store);
                final boolean available = latest > installedVersion() && validStoreUrl(store);
                main.post(() -> {
                    loading = false;
                    if (required) showMandatoryUpdate(store);
                    else if (fromParent && available) {
                        new AlertDialog.Builder(activity)
                                .setTitle("Update available / نسخه جدید")
                                .setMessage("A newer version is available on Cafe Bazaar.")
                                .setNegativeButton("Later / بعداً", null)
                                .setPositiveButton("Update / به‌روزرسانی", (d, w) -> openStore(store))
                                .show();
                    } else if (fromParent) {
                        Toast.makeText(activity, "No required update / آپدیت اجباری وجود ندارد",
                                Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Exception error) {
                main.post(() -> {
                    loading = false;
                    enforceCachedPolicy();
                    if (fromParent)
                        Toast.makeText(activity,
                                "Update check unavailable. Try online later. / بررسی آپدیت ممکن نیست.",
                                Toast.LENGTH_LONG).show();
                });
            } finally {
                if (conn != null) conn.disconnect();
            }
        }, "termeh-version-policy").start();
    }
}
