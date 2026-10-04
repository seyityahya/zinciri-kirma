import Foundation

/// Uygulama ile widget'ın ortak kullandığı veri (App Group UserDefaults).
/// Uygulama tarafı: src/data/storage.ios.ts — anahtar ve grup adı aynı olmalı.
enum SharedStore {
  static let appGroup = "group.com.seyit.sozumsoz"
  static let dataKey = "sozum.data.v1"
  static let reminderDebugKey = "sozum.reminders.lastSync"

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static func loadRoot() -> [String: Any]? {
    guard let text = defaults?.string(forKey: dataKey),
          let data = text.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data),
          let root = object as? [String: Any] else { return nil }
    return root
  }

  struct Snapshot {
    let habits: [ZKHabit]
    let settings: ZKSettings
  }

  /// Zincirler ve paylaşılan ayarlar; ayarlar genel "bugün" hesabı için de güncellenir.
  static func snapshot(now: Date = Date()) -> Snapshot {
    let root = loadRoot()
    let settings = ZKSettings(json: root?["settings"])
    ZKSettings.current = settings
    let today = DayMath.today(now, dayStartHour: settings.dayStartHour)
    return Snapshot(habits: ZKHabit.parseList(root, today: today), settings: settings)
  }

  static func loadHabits() -> [ZKHabit] {
    snapshot().habits
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

  /// Mantıksal bugünü tersine çevirir; yeni durumu döndürür.
  @discardableResult
  static func toggleToday(habitId: String, now: Date = Date()) -> Bool? {
    let snap = snapshot(now: now)
    let key = DayMath.key(DayMath.today(now, dayStartHour: snap.settings.dayStartHour))
    guard let habit = snap.habits.first(where: { $0.id == habitId }) else { return nil }
    let done = !habit.completions.contains(key)
    return setCompletion(habitId: habitId, day: key, done: done) ? done : nil
  }
}
