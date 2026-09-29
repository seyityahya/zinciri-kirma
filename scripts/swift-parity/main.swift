import Foundation

// Parite testi: targets/widget/ChainLogic.swift'i TypeScript mantığıyla karşılaştırır.
// Kullanım: parity <girdi.json>  → sonuçları stdout'a JSON olarak yazar.

func rounded(_ value: Double) -> Double { (value * 1e9).rounded() / 1e9 }

let path = CommandLine.arguments[1]
let input = try Data(contentsOf: URL(fileURLWithPath: path))
let cases = try JSONSerialization.jsonObject(with: input) as? [[String: Any]] ?? []

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
  let s = ChainLogic.status(habit, today: today)
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
  ]
  let slotCount = item["slotCount"] as? Int ?? 7
  let slots: [[String: Any]] = ChainLogic.recentSlots(habit, today: today, count: slotCount).map { slot in
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

let output = try JSONSerialization.data(withJSONObject: results, options: [.sortedKeys])
FileHandle.standardOutput.write(output)
