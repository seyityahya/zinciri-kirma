import Foundation

// Parite testi: targets/widget/ChainLogic.swift'i TypeScript mantığıyla karşılaştırır.
// Kullanım: parity <girdi.json>  → sonuçları stdout'a JSON olarak yazar.

func rounded(_ value: Double) -> Double { (value * 1e9).rounded() / 1e9 }

let path = CommandLine.arguments[1]
let input = try Data(contentsOf: URL(fileURLWithPath: path))
let root = try JSONSerialization.jsonObject(with: input) as? [String: Any] ?? [:]
let cases = root["cases"] as? [[String: Any]] ?? []
let groups = root["groups"] as? [[String: Any]] ?? []

var results: [Any] = []
for item in cases {
  guard let todayKey = item["today"] as? String, let today = DayMath.epochDay(todayKey) else {
    results.append(["error": "today"])
    continue
  }
  guard let habit = ZKHabit(json: item["habit"], today: today) else {
    results.append(NSNull())
    continue
  }
  let grace = item["grace"] as? Bool ?? true
  let s = ChainLogic.status(habit, today: today, grace: grace)
  let status: [String: Any] = [
    "streak": s.streak,
    "best": s.best,
    "total": s.total,
    "unit": s.unit,
    "doneToday": s.doneToday,
    "scheduledToday": s.scheduledToday,
    "dueToday": s.dueToday,
    "state": s.state,
    "chainStart": s.chainStart ?? NSNull(),
    "nextDue": s.nextDue ?? NSNull(),
    "week": s.week.map { ["done": $0.done, "target": $0.target, "daysLeft": $0.daysLeft] as [String: Any] } ?? NSNull(),
    "weekLost": s.weekLost,
    "successRate": s.successRate.map(rounded) ?? NSNull(),
    "graceUsed": s.graceUsed,
    "graceRenewIn": s.graceRenewIn ?? NSNull(),
    "graceAvailable": s.graceAvailable,
  ]
  let slotCount = item["slotCount"] as? Int ?? 7
  let slots: [[String: Any]] = ChainLogic.recentSlots(habit, today: today, count: slotCount, grace: grace).map { slot in
    var d: [String: Any] = ["key": slot.key, "state": slot.state]
    if let p = slot.progress { d["progress"] = rounded(p) }
    return d
  }
  let schedule: [String: Any]
  switch habit.schedule {
  case .days(let days): schedule = ["kind": "days", "days": days]
  case .interval(let every): schedule = ["kind": "interval", "every": every]
  case .weekly(let times): schedule = ["kind": "weekly", "times": times]
  }
  results.append([
    "habit": [
      "id": habit.id,
      "name": habit.name,
      "emoji": habit.emoji,
      "color": habit.color,
      "schedule": schedule,
      "startDate": habit.startDate,
      "completions": habit.completions,
    ] as [String: Any],
    "status": status,
    "text": ZKText.statusText(habit.schedule, s, today: today),
    "short": ZKText.shortStatus(habit.schedule, s, today: today),
    "label": ZKText.scheduleLabel(habit.schedule),
    "counts": ChainLogic.countsToday(habit.schedule, s),
    "slots": slots,
  ])
}

// Hatırlatma içerikleri: her grup birkaç zincir ve bir gün içerir.
var reminders: [Any] = []
for group in groups {
  guard let todayKey = group["today"] as? String, let today = DayMath.epochDay(todayKey) else { continue }
  let grace = group["grace"] as? Bool ?? true
  let items = (group["habits"] as? [Any] ?? []).compactMap { ZKHabit(json: $0, today: today) }.map { h in
    (name: h.name, emoji: h.emoji, schedule: h.schedule, status: ChainLogic.status(h, today: today, grace: grace))
  }
  if let r = ZKText.reminder(items) { reminders.append(["title": r.title, "body": r.body]) }
  else { reminders.append(NSNull()) }
}

let logical: [Any] = (root["logical"] as? [[String: Any]] ?? []).map { item in
  let ms = (item["ms"] as? NSNumber)?.doubleValue ?? 0
  let hour = item["hour"] as? Int ?? 3
  return DayMath.key(DayMath.today(Date(timeIntervalSince1970: ms / 1000), dayStartHour: hour))
}

// Hatırlatma planları
let plans: [Any] = (root["plans"] as? [[String: Any]] ?? []).map { item in
  let ms = (item["now"] as? NSNumber)?.doubleValue ?? 0
  let now = Date(timeIntervalSince1970: ms / 1000)
  let settings = ZKSettings(json: item["settings"])
  let today = DayMath.today(now, dayStartHour: settings.dayStartHour)
  let habits = (item["habits"] as? [Any] ?? []).compactMap { ZKHabit(json: $0, today: today) }
  return ReminderPlanner.plan(habits: habits, settings: settings, now: now).map { r in
    ["id": r.id, "day": r.day, "at": Int((r.at.timeIntervalSince1970 * 1000).rounded()), "title": r.title, "body": r.body] as [String: Any]
  }
}

let output = try JSONSerialization.data(withJSONObject: ["cases": results, "reminders": reminders, "logical": logical, "plans": plans], options: [.sortedKeys])
FileHandle.standardOutput.write(output)
