package com.example.bolivarhost

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.example.bolivarhost.theme.BolivarHostTheme

// CAMBIA ESTA URL POR LA DIRECCIÓN DE TU SERVIDOR DOKPLOY (ej: http://tu-ip:8085 o https://tu-dominio.com)
const val TARGET_URL = "http://77.42.17.7:8085/" 

class MainActivity : ComponentActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BolivarHostTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val context = androidx.compose.ui.platform.LocalContext.current
                    
                    // Create and remember WebView instance
                    val webView = remember {
                        WebView(context).apply {
                            layoutParams = android.view.ViewGroup.LayoutParams(
                                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                                android.view.ViewGroup.LayoutParams.MATCH_PARENT
                            )
                            webViewClient = object : WebViewClient() {
                                @Deprecated("Deprecated in Java")
                                override fun shouldOverrideUrlLoading(
                                    view: WebView?,
                                    url: String?
                                ): Boolean {
                                    return false // load links inside the WebView
                                }
                            }
                            
                            // Enable JS and storage to support modern React/SPA features
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.loadWithOverviewMode = true
                            settings.useWideViewPort = true
                            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            
                            loadUrl(TARGET_URL)
                        }
                    }

                    // Handle Android system Back button to navigate inside the WebView
                    BackHandler(enabled = true) {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            finish() // close the activity if cannot go back
                        }
                    }

                    // Render WebView in Compose
                    androidx.compose.ui.viewinterop.AndroidView(
                        factory = { webView },
                        modifier = Modifier
                            .fillMaxSize()
                            .safeDrawingPadding()
                    )
                }
            }
        }
    }
}
