package com.etqadem.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Screen-off "timer finished" alarm. @capacitor/local-notifications cannot set
 * Notification.FLAG_INSISTENT (loop the sound until dismissed), so the rest /
 * exercise timer end is scheduled here instead: AlarmManager.setAlarmClock
 * (exact and Doze-proof when the exact-alarm permission is granted, else an
 * inexact allow-while-idle alarm) fires {@link TimerAlarmReceiver},
 * which posts an insistent notification with a Stop action, capped at 30 s.
 * The web layer feature-detects this plugin and falls back to
 * LocalNotifications when it is absent (browser, older shells).
 */
@CapacitorPlugin(name = "TimerAlarm")
public class TimerAlarmPlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        long at = call.getData().optLong("at", 0L);
        if (id == null || at <= 0) {
            call.reject("id and at (epoch ms) are required");
            return;
        }
        Context ctx = getContext();
        Intent i = TimerAlarmReceiver.intent(ctx, id, call.getString("title", ""), call.getString("body", ""), call.getString("stopLabel", "Stop"));
        PendingIntent fire = PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent show = PendingIntent.getActivity(ctx, id, TimerAlarmReceiver.launchIntent(ctx), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        // setAlarmClock needs the "Alarms & reminders" permission (SCHEDULE_EXACT_ALARM,
        // denied by default on Android 14+; the web layer offers the opt-in once).
        // Without it: an inexact but still Doze-safe alarm, like the plain notification.
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
        try {
            if (exact) {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire); // revoked between the check and the call
        }
        JSObject res = new JSObject();
        res.put("exact", exact);
        call.resolve(res);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }
        Context ctx = getContext();
        Intent i = TimerAlarmReceiver.intent(ctx, id, "", "", "");
        PendingIntent fire = PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (fire != null) {
            ((AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE)).cancel(fire);
            fire.cancel();
        }
        ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(id);
        call.resolve(new JSObject());
    }
}
