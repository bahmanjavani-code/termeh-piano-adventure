package com.termeh.piano;
import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
public class MainActivity extends Activity {
 private WebView web;
 private PermissionRequest pending;
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  web=new WebView(this);
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setMediaPlaybackRequiresUserGesture(false);
  web.setWebViewClient(new WebViewClient());
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onPermissionRequest(PermissionRequest request){
    runOnUiThread(()->{
     boolean audio=false;
     for(String r:request.getResources()) if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) audio=true;
     if(!audio){request.deny();return;}
     if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)
      request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
     else {pending=request;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},21);}
    });
   }
  });
  setContentView(web);
  web.loadUrl("file:///android_asset/index.html");
 }
 @Override public void onRequestPermissionsResult(int code,String[] p,int[] grants){
  super.onRequestPermissionsResult(code,p,grants);
  if(code==21&&pending!=null){
   if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)
    pending.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
   else pending.deny();
   pending=null;
  }
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
}