package expo.modules.secureqr

import android.content.Context
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.view.SurfaceHolder
import android.view.SurfaceView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class SecureQrView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val surfaceView = SurfaceView(context)
  private val paint = Paint().apply {
    color = Color.BLACK
    style = Paint.Style.FILL
    isAntiAlias = false
  }

  var cells = ""
  var count = 0
  var codeSize = 0f
  var quiet = 16f
  private var surfaceReady = false

  init {
    setBackgroundColor(Color.WHITE)
    // setSecure applies to this surface only, and only if it is set before the
    // window attaches. The QR is drawn here so the window buffer never holds it.
    // Some phones still refuse the entire screenshot when any secure surface is showing.
    surfaceView.setSecure(true)
    surfaceView.holder.setFormat(PixelFormat.OPAQUE)
    surfaceView.holder.addCallback(
      object : SurfaceHolder.Callback {
        override fun surfaceCreated(holder: SurfaceHolder) {
          surfaceReady = true
          redraw()
        }

        override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
          surfaceReady = true
          redraw()
        }

        override fun surfaceDestroyed(holder: SurfaceHolder) {
          surfaceReady = false
        }
      },
    )
    addView(surfaceView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  override val shouldUseAndroidLayout: Boolean = true

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    super.onLayout(changed, left, top, right, bottom)
    surfaceView.layout(0, 0, right - left, bottom - top)
  }

  fun redraw() {
    if (!surfaceReady || !surfaceView.holder.surface.isValid) {
      return
    }
    val canvas = surfaceView.holder.lockCanvas() ?: return
    try {
      canvas.drawColor(Color.WHITE)
      val side = canvas.width.toFloat()
      if (side <= 0f || count <= 0 || cells.length != count * count) {
        return
      }
      val span = if (codeSize > 0f) codeSize else side
      val inset = side * quiet / (span + quiet * 2f)
      val cell = (side - inset * 2f) / count
      for (row in 0 until count) {
        for (column in 0 until count) {
          if (cells[row * count + column] != '1') {
            continue
          }
          val originX = inset + column * cell
          val originY = inset + row * cell
          canvas.drawRect(originX, originY, originX + cell + 1f, originY + cell + 1f, paint)
        }
      }
    } finally {
      surfaceView.holder.unlockCanvasAndPost(canvas)
    }
  }
}
