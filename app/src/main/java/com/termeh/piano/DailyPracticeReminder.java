package com.termeh.piano;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import androidx.work.WorkManager;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.concurrent.TimeUnit;

/**
 * Local, parent-opt-in daily exercise reminder. No account, network request,
 * analytics, child identifiers, exact-alarm permission or background service.
 * WorkManager timing is INEXACT: Android battery restrictions can delay a run.
 */
final class DailyPracticeReminder {
    private static final String PREFS = "termeh_parent_practice_reminder_v1";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_LAST_PRACTICE_DAY = "last_practice_day";
    private static final String KEY_LAST_REMINDER_DAY = "last_reminder_day";
    private static final String KEY_LANGUAGE = "ui_language";
    private static final String UNIQUE_WORK = "termeh_daily_practice_reminder_v1";
    private static final String CHANNEL_ID = "termeh_daily_practice";
    private static final int NOTICE_ID = 3107;
    private static final int SUGGESTED_HOUR = 18; // Local device time; inexact.

    private DailyPracticeReminder() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean optedIn(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    static boolean permissionGranted(Context context) {
        if (Build.VERSION.SDK_INT >= 33
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        return manager != null && manager.areNotificationsEnabled();
    }

    static String status(Context context) {
        if (!optedIn(context)) return "off";
        return permissionGranted(context) ? "on" : "blocked";
    }

    static void setLanguage(Context context, String language) {
        if (!"fa".equals(language) && !"en".equals(language)) return;
        prefs(context).edit().putString(KEY_LANGUAGE, language).apply();
    }

    static void recordCompletedExercise(Context context) {
        // The native side receives no notes, answers, age, name, contact or logs.
        prefs(context).edit().putString(KEY_LAST_PRACTICE_DAY, LocalDate.now().toString()).apply();
    }

    static void enable(Context context) {
        if (!permissionGranted(context)) return; // Never opt in after a denial.
        prefs(context).edit().putBoolean(KEY_ENABLED, true).apply();
        schedule(context, ExistingPeriodicWorkPolicy.REPLACE);
    }

    static void disable(Context context) {
        prefs(context).edit().putBoolean(KEY_ENABLED, false).apply();
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK);
        NotificationManager manager = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.cancel(NOTICE_ID);
    }

    static void ensureScheduled(Context context) {
        // Do not request permission or silently enable; WorkManager persists work
        // through normal app restarts, upgrades and device reboot.
        // KEEP is crucial: replacing work on every app launch would postpone
        // tonight's reminder again and again for an active child.
        if (optedIn(context) && permissionGranted(context)) {
            schedule(context, ExistingPeriodicWorkPolicy.KEEP);
        }
    }

    private static void schedule(Context context, ExistingPeriodicWorkPolicy policy) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime next = now.toLocalDate().atTime(SUGGESTED_HOUR, 0);
        if (!next.isAfter(now)) next = next.plusDays(1);
        long initialDelay = Math.max(1L, Duration.between(now, next).toMillis());
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                ReminderWorker.class, 24L, TimeUnit.HOURS)
                .setInitialDelay(initialDelay, TimeUnit.MILLISECONDS)
                .build();
        WorkManager.getInstance(context.getApplicationContext()).enqueueUniquePeriodicWork(
                UNIQUE_WORK, policy, request);
    }

    public static final class ReminderWorker extends Worker {
        public ReminderWorker(Context context, WorkerParameters params) {
            super(context, params);
        }

        @Override public Result doWork() {
            Context context = getApplicationContext();
            if (!optedIn(context) || !permissionGranted(context)) return Result.success();
            LocalTime now = LocalTime.now();
            // Respect evening boundaries even if Doze defers the background task.
            if (now.isBefore(LocalTime.of(16, 0)) || !now.isBefore(LocalTime.of(21, 0))) {
                return Result.success();
            }
            String today = LocalDate.now().toString();
            SharedPreferences settings = prefs(context);
            if (today.equals(settings.getString(KEY_LAST_PRACTICE_DAY, ""))
                    || today.equals(settings.getString(KEY_LAST_REMINDER_DAY, ""))) {
                return Result.success();
            }

            NotificationManager manager = (NotificationManager)
                    context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return Result.success();
            boolean english = "en".equals(settings.getString(KEY_LANGUAGE, "fa"));
            manager.createNotificationChannel(new NotificationChannel(
                    CHANNEL_ID,
                    english ? "Termeh Piano: daily practice" : "پیانوی ترمه: تمرین روزانه",
                    NotificationManager.IMPORTANCE_DEFAULT));

            Intent launch = new Intent(context, MainActivity.class);
            launch.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent tap = PendingIntent.getActivity(context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notification = new Notification.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_termeh)
                    .setContentTitle(english ? "🎹 Time for a little piano?" : "🎹 وقت یک تمرین کوتاه پیانوست!")
                    .setContentText(english ? "How about five fun minutes of music?"
                            : "پنج دقیقه با پیانوی ترمه تمرین کنیم؟")
                    .setAutoCancel(true)
                    .setContentIntent(tap)
                    .setCategory(Notification.CATEGORY_REMINDER)
                    .setVisibility(Notification.VISIBILITY_PRIVATE)
                    .build();
            try {
                manager.notify(NOTICE_ID, notification);
                settings.edit().putString(KEY_LAST_REMINDER_DAY, today).apply();
            } catch (SecurityException ignored) {
                // Revoked permission must never crash the game or trigger retries.
            }
            return Result.success();
        }
    }
}
