import Foundation

/// Uygulama ile widget'ın ortak kullandığı veri (App Group UserDefaults).
/// Uygulama tarafı: src/data/storage.ios.ts — anahtar ve grup adı aynı olmalı.
enum SharedStore {
  static let appGroup = "group.com.seyit.zincirikirma"
  static let dataKey = "zk.data.v1"

  private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static func loadRoot() -> [String: Any]? {
    guard let text = defaults?.string(forKey: dataKey),
          let data = text.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data),
          let root = object as? [String: Any] else { return nil }
    return root
  }

  static func loadHabits(today: Int = DayMath.today()) -> [ZKHabit] {
    ZKHabit.parseList(loadRoot(), today: today)
  }

  /// Bir günü işaretler ya da kaldırır. Bilinmeyen alanlara dokunmadan JSON'u günceller.
  @discardableResult
  static func setCompletion(habitId: String, day: String, done: Bool) -> Bool {
    guard var root = loadRoot(), let habits = root["habits"] as? [Any] else { return false }
    var changed = false
    let updated: [Any] = habits.map { item in
      guard var habit = item as? [String: Any], habit["id"] as? String == habitId else { return item }
      var completions = (habit["completions"] as? [Any] ?? []).compactMap { $0 as? String }
      let has = completions.contains(day)
      if has == done { return item }
      if done {
        completions.append(day)
      } else {
        completions.removeAll { $0 == day }
      }
      habit["completions"] = Array(Set(completions)).sorted()
      changed = true
      return habit
    }
    guard changed else { return false }

    root["habits"] = updated
    let previous = (root["updatedAt"] as? NSNumber)?.int64Value ?? 0
    let now = Int64((Date().timeIntervalSince1970 * 1000).rounded())
    root["updatedAt"] = NSNumber(value: max(now, previous + 1))

    guard let data = try? JSONSerialization.data(withJSONObject: root),
          let text = String(data: data, encoding: .utf8) else { return false }
    defaults?.set(text, forKey: dataKey)
    return true
  }

  /// Bugünü tersine çevirir; yeni durumu döndürür.
  @discardableResult
  static func toggleToday(habitId: String, now: Date = Date()) -> Bool? {
    let today = DayMath.today(now)
    let key = DayMath.key(today)
    guard let habit = loadHabits(today: today).first(where: { $0.id == habitId }) else { return nil }
    let done = !habit.completions.contains(key)
    return setCompletion(habitId: habitId, day: key, done: done) ? done : nil
  }
}
