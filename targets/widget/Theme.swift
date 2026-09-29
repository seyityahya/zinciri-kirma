import SwiftUI
import UIKit

enum ZKTheme {
  static let flame = Color(hex: "#FF6B3D")
  static let danger = Color(hex: "#E5484D")

  static let background = Color(UIColor { trait in
    trait.userInterfaceStyle == .dark
      ? UIColor(red: 0.10, green: 0.094, blue: 0.086, alpha: 1)
      : UIColor(red: 1, green: 1, blue: 1, alpha: 1)
  })

  static let track = Color(UIColor { trait in
    trait.userInterfaceStyle == .dark
      ? UIColor(white: 1, alpha: 0.14)
      : UIColor(white: 0, alpha: 0.08)
  })

  static let emptyLink = Color(UIColor { trait in
    trait.userInterfaceStyle == .dark
      ? UIColor(white: 1, alpha: 0.12)
      : UIColor(white: 0, alpha: 0.10)
  })
}

extension Color {
  init(hex: String) {
    var value: UInt64 = 0
    let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    Scanner(string: cleaned).scanHexInt64(&value)
    self.init(
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255
    )
  }
}

extension ZKHabit {
  var tint: Color { Color(hex: color) }
  var deepLink: URL? { URL(string: "zincirikirma://habit/\(id)") }
}
