import Foundation
import UserNotifications

/// Widget'tan "Yaptım"a basılınca akşam hatırlatmalarını, uygulamanın kurduğu planla
/// birebir aynı şekilde yeniden kurar (kimlik: sozum-reminder-YYYY-MM-DD).
/// Uygulama tarafı: src/notifications/reminders.ts
enum ReminderScheduler {
  static func sync(_ snapshot: SharedStore.Snapshot, now: Date = Date()) async {
    let center = UNUserNotificationCenter.current()
    let authorization = await center.notificationSettings().authorizationStatus
    let pending = await center.pendingNotificationRequests()
    let ours = pending.map(\.identifier).filter { $0.hasPrefix(ReminderPlanner.prefix) }

    let allowed = authorization == .authorized || authorization == .provisional || authorization == .ephemeral
    // Güvenlik: uygulamanın kurduğu hatırlatmaları göremiyorsak (ya da hiç yoksa) dokunma;
    // aksi hâlde aynı gün için ikinci bir bildirim oluşabilir. Plan 14 gün ileriye kurulduğu
    // için normalde her zaman görünür durumda en az bir hatırlatma vardır.
    guard allowed, !ours.isEmpty else {
      SharedStore.defaults?.set("seen=\(ours.count) planned=0 auth=\(authorization.rawValue) skipped", forKey: SharedStore.reminderDebugKey)
      return
    }
    let plan = ReminderPlanner.plan(habits: snapshot.habits, settings: snapshot.settings, now: now)

    center.removePendingNotificationRequests(withIdentifiers: ours)
    for reminder in plan {
      let content = UNMutableNotificationContent()
      content.title = reminder.title
      content.body = reminder.body
      content.sound = .default
      let components = DayMath.gregorian.dateComponents([.year, .month, .day, .hour, .minute, .second], from: reminder.at)
      let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
      try? await center.add(UNNotificationRequest(identifier: reminder.id, content: content, trigger: trigger))
    }

    // Tanılama: widget'ın uygulamanın kurduğu hatırlatmaları görüp görmediği.
    SharedStore.defaults?.set("seen=\(ours.count) planned=\(plan.count) auth=\(authorization.rawValue)", forKey: SharedStore.reminderDebugKey)
  }
}
