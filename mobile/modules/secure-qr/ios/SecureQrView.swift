import ExpoModulesCore
import UIKit

final class SecureQrView: ExpoView {
  let field: UITextField = {
    let field = UITextField()
    field.isSecureTextEntry = true
    field.isUserInteractionEnabled = false
    field.backgroundColor = .white
    field.borderStyle = .none
    field.tintColor = .clear
    return field
  }()

  let imageView = UIImageView()
  private var canvas: UIView?
  var cells = ""
  var count = 0
  var quiet: CGFloat = 16
  var codeSize: CGFloat = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .white
    isAccessibilityElement = false
    isUserInteractionEnabled = false
    imageView.isUserInteractionEnabled = false
    imageView.contentMode = .scaleToFill
    imageView.backgroundColor = .white
    addSubview(field)
    // Password fields are left out of screenshots and recordings. The QR is drawn
    // into that field's canvas so only this rectangle is blank in a capture.
    attachCanvas()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else {
      return
    }
    field.isSecureTextEntry = true
    attachCanvas()
    redraw()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    field.frame = bounds
    field.layoutIfNeeded()
    imageView.frame = canvas?.bounds ?? bounds
    redraw()
  }

  func redraw() {
    let side = bounds.width
    guard side > 0, count > 0, cells.count == count * count else {
      imageView.image = nil
      return
    }
    let scale = window?.windowScene?.screen.scale ?? 2
    imageView.image = qrImage(
      cells: cells,
      count: count,
      side: side,
      quiet: quiet,
      codeSize: codeSize > 0 ? codeSize : side,
      scale: scale
    )
  }

  private func attachCanvas() {
    let next = field.subviews.first { view in
      let name = String(describing: type(of: view))
      return name.contains("Canvas") || name.contains("TextFieldContent")
    } ?? field.subviews.first
    guard let next else {
      if imageView.superview == nil {
        addSubview(imageView)
      }
      return
    }
    canvas = next
    next.clipsToBounds = true
    next.isUserInteractionEnabled = false
    next.backgroundColor = .white
    if imageView.superview !== next {
      next.addSubview(imageView)
    }
  }
}

private func qrImage(cells: String, count: Int, side: CGFloat, quiet: CGFloat, codeSize: CGFloat, scale: CGFloat) -> UIImage {
  let format = UIGraphicsImageRendererFormat()
  format.opaque = true
  format.scale = scale
  let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
  let overlap = 1 / scale
  return renderer.image { context in
    UIColor.white.setFill()
    context.fill(CGRect(x: 0, y: 0, width: side, height: side))
    let inset = side * quiet / (codeSize + quiet * 2)
    let cell = (side - inset * 2) / CGFloat(count)
    UIColor.black.setFill()
    let marks = Array(cells)
    for row in 0..<count {
      for column in 0..<count where marks[row * count + column] == Character("1") {
        let originX = inset + CGFloat(column) * cell
        let originY = inset + CGFloat(row) * cell
        context.fill(CGRect(x: originX, y: originY, width: cell + overlap, height: cell + overlap))
      }
    }
  }
}
