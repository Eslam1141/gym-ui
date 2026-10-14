package com.etqadem.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

/** Posts the insistent "timer finished" notification (see {@link TimerAlarmPlugin}). */
public class TimerAlarmReceiver extends BroadcastReceiver {
    static final String CHANNEL_ID = "timer-alarm";
    static final String ACTION_FIRE = "com.etqadem.app.TIMER_ALARM_FIRE";
    static final String ACTION_STOP = "com.etqadem.app.TIMER_ALARM_STOP";
    static final long MAX_RING_MS = 30000;

    static Intent intent(Context ctx, int id, String title, String body, String stopLabel) {
        return new Intent(ctx, TimerAlarmReceiver.class).setAction(ACTION_FIRE)
            .putExtra("id", id).putExtra("title", title).putExtra("body", body).putExtra("stopLabel", stopLabel);
    }

    static Intent launchIntent(Context ctx) {
        return new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    }

    static Uri soundUri(Context ctx) {
        return Uri.parse("android.resource://" + ctx.getPackageName() + "/raw/timer_alarm");
    }

    /** Idempotent. Created at startup, before the web layer's own createChannel, so the sound plays as an alarm. */
    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Timer alarm", NotificationManager.IMPORTANCE_HIGH);
        ch.enableVibration(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setSound(soundUri(ctx), new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        nm.createNotificationChannel(ch);
    }

    @Override
    public void onReceive(Context ctx, Intent in) {
        int id = in.getIntExtra("id", 0);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (ACTION_STOP.equals(in.getAction())) {
            nm.cancel(id);
            return;
        }
        // App on screen: the in-app alarm rings, never a second one on top.
        if (MainActivity.isForeground()) return;
        ensureChannel(ctx);
        String stop = in.getStringExtra("stopLabel");
        PendingIntent stopPi = PendingIntent.getBroadcast(ctx, id,
            new Intent(ctx, TimerAlarmReceiver.class).setAction(ACTION_STOP).putExtra("id", id),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent open = PendingIntent.getActivity(ctx, id, launchIntent(ctx),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_timer)
            .setContentTitle(in.getStringExtra("title"))
            .setContentText(in.getStringExtra("body"))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(open)
            .setDeleteIntent(stopPi)
            .setAutoCancel(true)
            .setTimeoutAfter(MAX_RING_MS) // 26+: removing it ends the looping sound
            .addAction(0, stop == null || stop.isEmpty() ? "Stop" : stop, stopPi);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            b.setSound(soundUri(ctx), AudioManager.STREAM_ALARM).setVibrate(new long[] {0, 450, 150, 450, 150, 450});
        }
        Notification n = b.build();
        n.flags |= Notification.FLAG_INSISTENT;
        try {
            nm.notify(id, n);
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS revoked since scheduling
        }
    }
}
