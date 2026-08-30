package com.fedi.nur;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Reports the magnetometer's real hardware accuracy to the Qibla page. The heading itself
// still comes from the web DeviceOrientationEvent API (see pages/Qibla.tsx) — that API has
// no way to expose calibration/accuracy at all, only native Android's SensorManager does
// (via onAccuracyChanged). This plugin exists purely to surface that one callback to JS.
//
// Fires an 'accuracyChanged' event with a 0-3 value while listening:
//   0 = SENSOR_STATUS_UNRELIABLE, 1 = LOW, 2 = MEDIUM, 3 = HIGH (matches SensorManager's own
//   constants, so no separate mapping is needed on the JS side beyond a >=/== check).
@CapacitorPlugin(name = "CompassAccuracy")
public class CompassAccuracyPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor magnetometer;
    private int lastAccuracy = -1;

    @PluginMethod
    public void start(PluginCall call) {
        ensureSensor();
        if (sensorManager != null && magnetometer != null) {
            sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_NORMAL);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        lastAccuracy = -1;
        call.resolve();
    }

    private void ensureSensor() {
        if (sensorManager == null) {
            sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
            magnetometer = sensorManager != null ? sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) : null;
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor == null || sensor.getType() != Sensor.TYPE_MAGNETIC_FIELD || accuracy == lastAccuracy) return;
        lastAccuracy = accuracy;
        JSObject data = new JSObject();
        data.put("accuracy", accuracy);
        notifyListeners("accuracyChanged", data);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        // Unused — only onAccuracyChanged above is needed.
    }

    @Override
    protected void handleOnDestroy() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        super.handleOnDestroy();
    }
}
