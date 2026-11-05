import ExpoModulesCore

public class SecureQrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SecureQr")

    View(SecureQrView.self) {
      Prop("cells") { (view: SecureQrView, cells: String) in
        view.cells = cells
      }

      Prop("count") { (view: SecureQrView, count: Int) in
        view.count = count
      }

      Prop("size") { (view: SecureQrView, size: Double) in
        view.codeSize = CGFloat(size)
      }

      Prop("quiet") { (view: SecureQrView, quiet: Double) in
        view.quiet = CGFloat(quiet)
      }

      OnViewDidUpdateProps { (view: SecureQrView) in
        view.redraw()
      }
    }
  }
}
