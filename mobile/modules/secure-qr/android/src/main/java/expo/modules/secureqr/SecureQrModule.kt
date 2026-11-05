package expo.modules.secureqr

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SecureQrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SecureQr")

    View(SecureQrView::class) {
      Prop("cells") { view: SecureQrView, cells: String ->
        view.cells = cells
      }

      Prop("count") { view: SecureQrView, count: Int ->
        view.count = count
      }

      Prop("size") { view: SecureQrView, size: Double ->
        view.codeSize = size.toFloat()
      }

      Prop("quiet") { view: SecureQrView, quiet: Double ->
        view.quiet = quiet.toFloat()
      }

      OnViewDidUpdateProps { view: SecureQrView ->
        view.redraw()
      }
    }
  }
}
