import Foundation

// Bu dosya src/domain/{dates,streak,labels,validate}.ts dosyalarının Swift karşılığıdır.
// Kurallar birebir aynı olmalı: `npm run test:swift` iki tarafı rastgele verilerle karşılaştırır.
// Yalnızca Foundation kullanır (WidgetKit/SwiftUI yok) ki macOS'ta tek başına derlenebilsin.

// MARK: - Gün hesapları

enum DayMath {
  /// Howard Hinnant'ın takvim algoritması: 1970-01-01'den beri geçen gün.
  static func daysFromCivil(_ year: Int, _ month: Int, _ day: Int) -> Int {
    let y = month <= 2 ? year - 1 : year
    let era = (y >= 0 ? y : y - 399) / 400
    let yoe = y - era * 400
    let mp = (month + 9) % 12
    let doy = (153 * mp + 2) / 5 + day - 1
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146_097 + doe - 719_468
  }

  static func civil(_ days: Int) -> (year: Int, month: Int, day: Int) {
    let z = days + 719_468
    let era = (z >= 0 ? z : z - 146_096) / 146_097
    let doe = z - era * 146_097
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
    let y = yoe + era * 400
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    let mp = (5 * doy + 2) / 153
    let d = doy - (153 * mp + 2) / 5 + 1
    let m = mp < 10 ? mp + 3 : mp - 9
    return (m <= 2 ? y + 1 : y, m, d)
  }

  static func daysInMonth(_ year: Int, _ month: Int) -> Int {
    let next = month == 12 ? daysFromCivil(year + 1, 1, 1) : daysFromCivil(year, month + 1, 1)
    return next - daysFromCivil(year, month, 1)
  }

  static func parse(_ key: String) -> (year: Int, month: Int, day: Int)? {
    let bytes = Array(key.utf8)
    guard bytes.count == 10, bytes[4] == 45, bytes[7] == 45 else { return nil }
    func number(_ range: Range<Int>) -> Int? {
      var value = 0
      for i in range {
        let c = bytes[i]
        guard c >= 48, c <= 57 else { return nil }
        value = value * 10 + Int(c - 48)
      }
      return value
    }
    guard let y = number(0..<4), let m = number(5..<7), let d = number(8..<10) else { return nil }
    guard y >= 1900, m >= 1, m <= 12, d >= 1, d <= daysInMonth(y, m) else { return nil }
    return (y, m, d)
  }

  static func isValid(_ key: String) -> Bool { parse(key) != nil }

  static func epochDay(_ key: String) -> Int? {
    guard let p = parse(key) else { return nil }
    return daysFromCivil(p.year, p.month, p.day)
  }

  static func key(_ day: Int) -> String {
    let c = civil(day)
    return "\(pad(c.year, 4))-\(pad(c.month, 2))-\(pad(c.day, 2))"
  }

  private static func pad(_ value: Int, _ width: Int) -> String {
    let s = String(value)
    return s.count >= width ? s : String(repeating: "0", count: width - s.count) + s
  }

  /// 0 = Pazartesi … 6 = Pazar
  static func weekday(_ day: Int) -> Int { (((day + 3) % 7) + 7) % 7 }

  static func weekStart(_ day: Int) -> Int { day - weekday(day) }

  /// Her zaman Miladi takvim (kullanıcı Budist/Hicri/Japon takvimi seçmiş olsa bile) ve yerel saat dilimi.
  static var gregorian: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    return calendar
  }

  /// Yerel saate göre takvim günü (epoch).
  static func calendarDay(_ date: Date, calendar: Calendar = DayMath.gregorian) -> Int {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return daysFromCivil(c.year ?? 1970, c.month ?? 1, c.day ?? 1)
  }

  /// "Mantıksal" bugün: gün `dayStartHour` saatinde biter (src/domain/dates.ts → logicalDayKey).
  static func today(_ date: Date = Date(), dayStartHour: Int = ZKSettings.current.dayStartHour, calendar: Calendar = DayMath.gregorian) -> Int {
    let hour = calendar.component(.hour, from: date)
    let day = calendarDay(date, calendar: calendar)
    return hour < dayStartHour ? day - 1 : day
  }

  /// Bir sonraki gün değişim anı (yerel dayStartHour:00).
  static func nextBoundary(after date: Date, dayStartHour: Int, calendar: Calendar = DayMath.gregorian) -> Date {
    let startOfDay = calendar.startOfDay(for: date)
    if let candidate = calendar.date(bySettingHour: dayStartHour, minute: 0, second: 0, of: startOfDay), candidate > date {
      return candidate
    }
    let tomorrow = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? date.addingTimeInterval(86_400)
    return calendar.date(bySettingHour: dayStartHour, minute: 0, second: 0, of: tomorrow) ?? tomorrow
  }
}

// MARK: - Model

enum ZKSchedule: Equatable {
  case days([Int])
  case interval(Int)
  case weekly(Int)

  static let allDays = [0, 1, 2, 3, 4, 5, 6]

  init(json: Any?) {
    let dict = json as? [String: Any] ?? [:]
    switch dict["kind"] as? String {
    case "interval":
      self = .interval(ZKSchedule.clamp(dict["every"], 2, 30, 2))
    case "weekly":
      self = .weekly(ZKSchedule.clamp(dict["times"], 1, 7, 1))
    default:
      var days = Set<Int>()
      for item in dict["days"] as? [Any] ?? [] {
        if let n = item as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() {
          let v = n.doubleValue
          if v == v.rounded(), v >= 0, v <= 6 { days.insert(Int(v)) }
        }
      }
      self = .days(days.isEmpty ? ZKSchedule.allDays : days.sorted())
    }
  }

  private static func clamp(_ value: Any?, _ lo: Int, _ hi: Int, _ fallback: Int) -> Int {
    var n = fallback
    if let num = value as? NSNumber, CFGetTypeID(num) != CFBooleanGetTypeID(), num.doubleValue.isFinite {
      n = Int(num.doubleValue.rounded(.toNearestOrAwayFromZero))
    }
    return min(hi, max(lo, n))
  }
}

struct ZKHabit: Identifiable, Equatable {
  static let defaultColor = "#FF6B3D"
  static let defaultEmoji = "🔥"

  let id: String
  let name: String
  let emoji: String
  let color: String
  let schedule: ZKSchedule
  let startDate: String
  let completions: [String]

  init(id: String, name: String, emoji: String, color: String, schedule: ZKSchedule, startDate: String, completions: [String]) {
    self.id = id
    self.name = name
    self.emoji = emoji
    self.color = color
    self.schedule = schedule
    self.startDate = startDate
    self.completions = completions
  }

  init?(json: Any?, today: Int = DayMath.today()) {
    guard let dict = json as? [String: Any],
          let id = dict["id"] as? String, !id.isEmpty,
          let rawName = dict["name"] as? String else { return nil }
    let name = String(rawName.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40))
    guard !name.isEmpty else { return nil }

    let completions = Array(Set((dict["completions"] as? [Any] ?? []).compactMap { $0 as? String }.filter(DayMath.isValid))).sorted()
    let start = (dict["startDate"] as? String).flatMap { DayMath.isValid($0) ? $0 : nil }

    let emoji = (dict["emoji"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? ZKHabit.defaultEmoji
    var color = ZKHabit.defaultColor
    if let c = dict["color"] as? String, ZKHabit.isHex(c) { color = c.uppercased() }

    self.init(
      id: id,
      name: name,
      emoji: emoji,
      color: color,
      schedule: ZKSchedule(json: dict["schedule"]),
      startDate: start ?? completions.first ?? DayMath.key(today),
      completions: completions
    )
  }

  static func isHex(_ value: String) -> Bool {
    let bytes = Array(value.utf8)
    guard bytes.count == 7, bytes[0] == 35 else { return false }
    return bytes[1...].allSatisfy { ($0 >= 48 && $0 <= 57) || ($0 >= 65 && $0 <= 70) || ($0 >= 97 && $0 <= 102) }
  }

  static func parseList(_ root: [String: Any]?, today: Int = DayMath.today()) -> [ZKHabit] {
    var seen = Set<String>()
    var result: [ZKHabit] = []
    for item in root?["habits"] as? [Any] ?? [] {
      if let habit = ZKHabit(json: item, today: today), !seen.contains(habit.id) {
        seen.insert(habit.id)
        result.append(habit)
      }
    }
    return result
  }
}

// MARK: - Ayarlar

/// src/domain/types.ts → AppSettings
struct ZKSettings: Equatable {
  var dayStartHour: Int
  var grace: Bool
  var reminderEnabled: Bool
  var reminderHour: Int
  var reminderMinute: Int

  static let defaults = ZKSettings(dayStartHour: 3, grace: true, reminderEnabled: true, reminderHour: 21, reminderMinute: 0)

  init(dayStartHour: Int, grace: Bool, reminderEnabled: Bool, reminderHour: Int, reminderMinute: Int) {
    self.dayStartHour = dayStartHour
    self.grace = grace
    self.reminderEnabled = reminderEnabled
    self.reminderHour = reminderHour
    self.reminderMinute = reminderMinute
  }

  init(json: Any?) {
    let d = ZKSettings.defaults
    let v = json as? [String: Any] ?? [:]
    let r = v["reminder"] as? [String: Any] ?? [:]
    func bool(_ value: Any?, _ fallback: Bool) -> Bool {
      if let n = value as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() { return n.boolValue }
      return fallback
    }
    dayStartHour = ZKSettings.clamp(v["dayStartHour"], 0, 6, d.dayStartHour)
    grace = bool(v["grace"], d.grace)
    reminderEnabled = bool(r["enabled"], d.reminderEnabled)
    reminderHour = ZKSettings.clamp(r["hour"], 0, 23, d.reminderHour)
    reminderMinute = ZKSettings.clamp(r["minute"], 0, 59, d.reminderMinute)
  }

  static func clamp(_ value: Any?, _ lo: Int, _ hi: Int, _ fallback: Int) -> Int {
    var n = fallback
    if let num = value as? NSNumber, CFGetTypeID(num) != CFBooleanGetTypeID(), num.doubleValue.isFinite {
      n = Int(num.doubleValue.rounded(.toNearestOrAwayFromZero))
    }
    return min(hi, max(lo, n))
  }

  /// Widget uzantısında paylaşılan veriden okunan güncel ayarlar (testte varsayılanlar).
  nonisolated(unsafe) static var current = ZKSettings.defaults
}

// MARK: - Durum

struct ZKWeek: Equatable {
  let done: Int
  let target: Int
  let daysLeft: Int
}

struct ZKStatus: Equatable {
  var streak: Int
  var best: Int
  var total: Int
  var unit: String
  var doneToday: Bool
  var scheduledToday: Bool
  var dueToday: Bool
  var state: String
  var chainStart: String?
  var nextDue: String?
  var week: ZKWeek?
  var weekLost: Bool
  var successRate: Double?
  var graceUsed: Bool
  var graceRenewIn: Int?
  var graceAvailable: Bool
}

struct ZKSlot: Equatable {
  let key: String
  let state: String
  var progress: Double? = nil
}

private struct Prepared {
  let today: Int
  let days: [Int]
  let set: Set<Int>
  let first: Int?
  let origin: Int
}

/// Beklenen halka: "done" / "miss" / "pending"
private struct Occurrence {
  let state: String
  let day: Int
}

private struct Evaluation {
  let occ: [Occurrence]
  let missKind: [Int: String]
  let run: Int
  let bestRun: Int
  let chainStartIdx: Int?
  let lastMissIdx: Int?
  let everDone: Bool
  let nextIdx: Int
}

private struct WeekInfo {
  let start: Int
  let target: Int
  let count: Int
  let from: Int
  let to: Int
}

enum ChainLogic {
  static let graceWindow = 7

  private static func prepare(_ habit: ZKHabit, _ today: Int) -> Prepared {
    let days = Array(Set(habit.completions.compactMap(DayMath.epochDay).filter { $0 <= today })).sorted()
    let start = min(DayMath.epochDay(habit.startDate) ?? today, today)
    let first = days.first
    return Prepared(today: today, days: days, set: Set(days), first: first, origin: min(start, first ?? Int.max))
  }

  private static func evaluate(_ occ: [Occurrence], _ grace: Bool) -> Evaluation {
    var missKind: [Int: String] = [:]
    var run = 0
    var bestRun = 0
    var chainStartIdx: Int? = nil
    var lastMissIdx: Int? = nil
    var everDone = false
    var nextIdx: Int? = nil
    for (i, o) in occ.enumerated() {
      if o.state == "done" {
        if run == 0 { chainStartIdx = i }
        run += 1
        everDone = true
        bestRun = max(bestRun, run)
      } else if o.state == "miss" {
        let forgivable = grace && run > 0 && (lastMissIdx.map { i - $0 >= graceWindow } ?? true)
        if forgivable {
          missKind[i] = "forgiven"
        } else {
          missKind[i] = "broken"
          run = 0
          chainStartIdx = nil
        }
        lastMissIdx = i
      } else if nextIdx == nil {
        nextIdx = i
      }
    }
    return Evaluation(occ: occ, missKind: missKind, run: run, bestRun: bestRun, chainStartIdx: chainStartIdx,
                      lastMissIdx: lastMissIdx, everDone: everDone, nextIdx: nextIdx ?? occ.count)
  }

  private static func graceInfo(_ ev: Evaluation, _ grace: Bool) -> (used: Bool, renewIn: Int?, available: Bool) {
    if !grace || ev.run == 0 { return (false, nil, false) }
    let distance = ev.lastMissIdx.map { ev.nextIdx - $0 } ?? graceWindow
    if distance >= graceWindow { return (false, nil, true) }
    return (true, graceWindow - distance, false)
  }

  private static func stateOf(_ alive: Bool, _ everDone: Bool, _ due: Bool) -> String {
    if alive { return due ? "pending" : "active" }
    return everDone ? "broken" : "new"
  }

  static func status(_ habit: ZKHabit, today: Int, grace: Bool) -> ZKStatus {
    let p = prepare(habit, today)
    switch habit.schedule {
    case .days(let days): return daysStatus(Set(days), p, grace)
    case .interval(let every): return intervalStatus(every, p, grace)
    case .weekly(let times): return weeklyStatus(times, p, grace)
    }
  }

  // MARK: Haftanın belirli günleri

  private static func daysOccurrences(_ isPlanned: (Int) -> Bool, _ p: Prepared) -> [Occurrence] {
    var out: [Occurrence] = []
    let t = p.today
    guard let first = p.first else {
      if isPlanned(t) { out.append(Occurrence(state: "pending", day: t)) }
      return out
    }
    var d = first
    while d <= t {
      if isPlanned(d) {
        if p.set.contains(d) { out.append(Occurrence(state: "done", day: d)) }
        else { out.append(Occurrence(state: d == t ? "pending" : "miss", day: d)) }
      }
      d += 1
    }
    return out
  }

  private static func daysStatus(_ planned: Set<Int>, _ p: Prepared, _ grace: Bool) -> ZKStatus {
    let t = p.today
    func isPlanned(_ d: Int) -> Bool { planned.contains(DayMath.weekday(d)) }
    let ev = evaluate(daysOccurrences(isPlanned, p), grace)

    var plannedCount = 0
    var doneCount = 0
    var d = p.origin
    while d <= t {
      if isPlanned(d) {
        let done = p.set.contains(d)
        if !(d == t && !done) {
          plannedCount += 1
          if done { doneCount += 1 }
        }
      }
      d += 1
    }

    var nextDue: Int? = nil
    if !planned.isEmpty {
      for n in (t + 1)...(t + 7) where isPlanned(n) {
        nextDue = n
        break
      }
    }

    let doneToday = p.set.contains(t)
    let scheduledToday = isPlanned(t)
    let dueToday = scheduledToday && !doneToday
    let alive = ev.run > 0
    let g = graceInfo(ev, grace)
    return ZKStatus(
      streak: ev.run,
      best: ev.bestRun,
      total: p.days.count,
      unit: "day",
      doneToday: doneToday,
      scheduledToday: scheduledToday,
      dueToday: dueToday,
      state: stateOf(alive, ev.everDone, dueToday),
      chainStart: ev.chainStartIdx.map { DayMath.key(ev.occ[$0].day) },
      nextDue: nextDue.map(DayMath.key),
      week: nil,
      weekLost: false,
      successRate: plannedCount > 0 ? Double(doneCount) / Double(plannedCount) : nil,
      graceUsed: g.used,
      graceRenewIn: g.renewIn,
      graceAvailable: g.available
    )
  }

  // MARK: N günde bir

  private static func intervalOccurrences(_ every: Int, _ p: Prepared) -> [Occurrence] {
    var out: [Occurrence] = []
    let list = p.days
    let t = p.today
    for i in list.indices {
      if i > 0 {
        let gap = list[i] - list[i - 1]
        let misses = gap > every ? Int((Double(gap) / Double(every)).rounded(.up)) - 1 : 0
        if misses > 0 {
          for k in 1...misses { out.append(Occurrence(state: "miss", day: list[i - 1] + k * every)) }
        }
      }
      out.append(Occurrence(state: "done", day: list[i]))
    }
    guard let last = list.last else {
      out.append(Occurrence(state: "pending", day: t))
      return out
    }
    let elapsed = t - last
    if elapsed > 0 {
      let misses = Int((Double(elapsed) / Double(every)).rounded(.up)) - 1
      if misses > 0 {
        for k in 1...misses { out.append(Occurrence(state: "miss", day: last + k * every)) }
      }
      out.append(Occurrence(state: "pending", day: last + (misses + 1) * every))
    }
    return out
  }

  private static func intervalStatus(_ every: Int, _ p: Prepared, _ grace: Bool) -> ZKStatus {
    let t = p.today
    let ev = evaluate(intervalOccurrences(every, p), grace)
    let list = p.days
    let last = list.last
    let doneToday = last == t
    let alive = ev.run > 0

    var nextDue: Int? = nil
    if alive, let last {
      if doneToday { nextDue = t + every }
      else if let pending = ev.occ.last, pending.state == "pending" { nextDue = pending.day }
      else { nextDue = last + every }
    }
    let dueToday = alive && !doneToday && nextDue == t
    let g = graceInfo(ev, grace)
    return ZKStatus(
      streak: ev.run,
      best: ev.bestRun,
      total: list.count,
      unit: "time",
      doneToday: doneToday,
      scheduledToday: true,
      dueToday: dueToday,
      state: stateOf(alive, ev.everDone, dueToday),
      chainStart: ev.chainStartIdx.map { DayMath.key(ev.occ[$0].day) },
      nextDue: nextDue.map(DayMath.key),
      week: nil,
      weekLost: false,
      successRate: nil,
      graceUsed: g.used,
      graceRenewIn: g.renewIn,
      graceAvailable: g.available
    )
  }

  // MARK: Haftada N kez

  private static func weekCount(_ p: Prepared, _ weekStart: Int) -> Int {
    var c = 0
    var d = weekStart
    while d < weekStart + 7 && d <= p.today {
      if p.set.contains(d) { c += 1 }
      d += 1
    }
    return c
  }

  private static func weeklyModel(_ times: Int, _ p: Prepared) -> (occ: [Occurrence], weeks: [WeekInfo]) {
    let t = p.today
    let current = DayMath.weekStart(t)
    let startDay = p.first ?? t
    let firstWeek = DayMath.weekStart(startDay)
    var occ: [Occurrence] = []
    var weeks: [WeekInfo] = []
    var w = firstWeek
    while w <= current {
      let target = w == firstWeek ? min(times, 7 - DayMath.weekday(startDay)) : times
      let count = min(weekCount(p, w), target)
      let from = occ.count
      for _ in 0..<count { occ.append(Occurrence(state: "done", day: w)) }
      if count < target {
        for _ in count..<target { occ.append(Occurrence(state: w < current ? "miss" : "pending", day: w)) }
      }
      weeks.append(WeekInfo(start: w, target: target, count: count, from: from, to: occ.count))
      w += 7
    }
    return (occ, weeks)
  }

  private static func weekVerdict(_ ev: Evaluation, _ week: WeekInfo) -> String {
    if week.count >= week.target { return "done" }
    if (week.from..<week.to).contains(where: { ev.missKind[$0] == "broken" }) { return "missed" }
    if (week.from..<week.to).contains(where: { ev.missKind[$0] == "forgiven" }) { return "forgiven" }
    return "pending"
  }

  private static func weeklyStatus(_ times: Int, _ p: Prepared, _ grace: Bool) -> ZKStatus {
    let t = p.today
    let model = weeklyModel(times, p)
    let ev = evaluate(model.occ, grace)
    let current = DayMath.weekStart(t)

    var run = 0
    var best = 0
    var closedWeeks = 0
    var doneWeeks = 0
    for week in model.weeks {
      let verdict = weekVerdict(ev, week)
      if verdict == "missed" {
        run = 0
      } else if verdict == "done" {
        run += 1
        best = max(best, run)
      }
      if week.start < current || verdict == "done" {
        closedWeeks += 1
        if verdict == "done" { doneWeeks += 1 }
      }
    }
    let alive = ev.run > 0
    let chainStart = alive ? ev.chainStartIdx.map { ev.occ[$0].day } : nil

    let currentWeek = model.weeks[model.weeks.count - 1]
    let done = currentWeek.count
    let target = currentWeek.target
    let doneToday = p.set.contains(t)
    let weekday = DayMath.weekday(t)
    let needed = max(0, target - done)
    let available = doneToday ? 6 - weekday : 7 - weekday
    let weekLost = needed > available
    let dueToday = !doneToday && needed > 0 && needed == available
    let g = graceInfo(ev, grace)
    return ZKStatus(
      streak: alive ? run : 0,
      best: best,
      total: p.days.count,
      unit: "week",
      doneToday: doneToday,
      scheduledToday: true,
      dueToday: dueToday,
      state: stateOf(alive, ev.everDone, dueToday),
      chainStart: chainStart.map(DayMath.key),
      nextDue: nil,
      week: ZKWeek(done: done, target: target, daysLeft: 7 - weekday),
      weekLost: weekLost,
      successRate: closedWeeks > 0 ? Double(doneWeeks) / Double(closedWeeks) : nil,
      graceUsed: g.used,
      graceRenewIn: g.renewIn,
      graceAvailable: g.available
    )
  }

  /// src/domain/streak.ts → countsToday ile aynı.
  static func countsToday(_ schedule: ZKSchedule, _ s: ZKStatus) -> Bool {
    if s.doneToday { return true }
    switch schedule {
    case .days: return s.scheduledToday
    case .weekly: return s.week.map { $0.done < $0.target } == true && !s.weekLost
    case .interval: return s.dueToday || s.state == "new" || s.state == "broken"
    }
  }

  // MARK: Zincir halkaları

  private static func occurrenceSlot(_ ev: Evaluation, _ i: Int, _ key: String) -> ZKSlot {
    let o = ev.occ[i]
    if o.state == "done" { return ZKSlot(key: key, state: "done") }
    if o.state == "pending" { return ZKSlot(key: key, state: "pending") }
    return ZKSlot(key: key, state: ev.missKind[i] == "forgiven" ? "forgiven" : "missed")
  }

  static func recentSlots(_ habit: ZKHabit, today: Int, count: Int, grace: Bool) -> [ZKSlot] {
    let p = prepare(habit, today)
    var slots: [ZKSlot] = []

    switch habit.schedule {
    case .days(let days):
      let planned = Set(days)
      let ev = evaluate(daysOccurrences({ planned.contains(DayMath.weekday($0)) }, p), grace)
      let from = max(0, ev.occ.count - count)
      for i in from..<ev.occ.count { slots.append(occurrenceSlot(ev, i, DayMath.key(ev.occ[i].day))) }

    case .weekly(let times):
      let model = weeklyModel(times, p)
      let ev = evaluate(model.occ, grace)
      let current = DayMath.weekStart(p.today)
      var byStart: [Int: WeekInfo] = [:]
      for w in model.weeks { byStart[w.start] = w }
      for i in stride(from: count - 1, through: 0, by: -1) {
        let start = current - i * 7
        guard let week = byStart[start] else {
          slots.append(ZKSlot(key: DayMath.key(start), state: "empty"))
          continue
        }
        let progress = week.target > 0 ? min(1, Double(week.count) / Double(week.target)) : 0
        slots.append(ZKSlot(key: DayMath.key(start), state: weekVerdict(ev, week), progress: progress))
      }

    case .interval(let every):
      let ev = evaluate(intervalOccurrences(every, p), grace)
      let from = max(0, ev.occ.count - count)
      for i in from..<ev.occ.count {
        let o = ev.occ[i]
        let key = o.state == "done" ? DayMath.key(o.day) : (o.state == "pending" ? "next" : "miss-\(DayMath.key(o.day))")
        slots.append(occurrenceSlot(ev, i, key))
      }
    }

    var pad = 0
    while slots.count < count {
      slots.insert(ZKSlot(key: "empty-\(pad)", state: "empty"), at: 0)
      pad += 1
    }
    return slots
  }
}

// MARK: - Metinler

enum ZKText {
  static let weekdayNames = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
  static let weekdayShort = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
  static let monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
  static let monthShort = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]

  static func scheduleLabel(_ schedule: ZKSchedule) -> String {
    switch schedule {
    case .days(let raw):
      let days = raw.sorted()
      if days.count == 7 { return "Her gün" }
      if days == [0, 1, 2, 3, 4] { return "Hafta içi her gün" }
      if days == [5, 6] { return "Hafta sonları" }
      if days.count == 1 { return "Her \(weekdayNames[days[0]])" }
      return days.map { weekdayShort[$0] }.joined(separator: ", ")
    case .interval(let every):
      return "\(every) günde bir"
    case .weekly(let times):
      return times == 1 ? "Haftada bir" : "Haftada \(times) kez"
    }
  }

  static func unitLabel(_ unit: String) -> String {
    switch unit {
    case "week": return "hafta"
    case "time": return "kez"
    default: return "gün"
    }
  }

  static func chainLengthLabel(_ unit: String) -> String {
    switch unit {
    case "week": return "haftalık zincir"
    case "time": return "halkalık zincir"
    default: return "günlük zincir"
    }
  }

  static func relativeDay(_ day: String, today: Int) -> String {
    guard let d = DayMath.epochDay(day) else { return day }
    let diff = d - today
    if diff == 0 { return "bugün" }
    if diff == 1 { return "yarın" }
    if diff > 1 && diff < 7 { return weekdayNames[DayMath.weekday(d)] }
    let c = DayMath.civil(d)
    return "\(c.day) \(monthNames[c.month - 1])"
  }

  static func statusText(_ schedule: ZKSchedule, _ s: ZKStatus, today: Int) -> String {
    switch schedule {
    case .days:
      if s.doneToday { return s.scheduledToday ? "Bugün tamamlandı" : "İzin gününde ekstra halka" }
      if !s.scheduledToday {
        if let next = s.nextDue { return "Bugün izin günü · sıradaki \(relativeDay(next, today: today))" }
        return "Bugün izin günü"
      }
      if s.state == "pending" {
        return s.graceUsed ? "Hata payını kullandın · bugün kaçırma" : "Zinciri korumak için bugün yap"
      }
      if s.state == "broken" { return "Zincir kırıldı · bugün yeniden başla" }
      return "İlk halkayı bugün ekle"
    case .interval:
      if s.doneToday { return "Bugün tamamlandı" }
      if s.state == "broken" { return "Zincir kırıldı · yeniden başla" }
      if s.state == "new" { return "İlk halkayı ekle" }
      if s.dueToday { return s.graceUsed ? "Bugün son gün · hata payın yok" : "Bugün son gün!" }
      let left = s.nextDue.flatMap(DayMath.epochDay).map { $0 - today } ?? 0
      return left == 1 ? "En geç yarın yap" : "En geç \(left) gün içinde yap"
    case .weekly(let times):
      let week = s.week ?? ZKWeek(done: 0, target: times, daysLeft: 0)
      let progress = "Bu hafta \(week.done)/\(week.target)"
      let needed = week.target - week.done
      if needed <= 0 { return "\(progress) · hedef tamam" }
      if s.weekLost {
        let available = s.doneToday ? week.daysLeft - 1 : week.daysLeft
        let graceSaves = s.graceAvailable && needed - available == 1
        return graceSaves ? "\(progress) · hata payı kullanılacak" : "\(progress) · hedef kaçtı"
      }
      if s.dueToday { return "\(progress) · bugün şart" }
      if s.state == "broken" && week.done == 0 { return "Zincir kırıldı · bu hafta yeniden başla" }
      return "\(progress) · \(needed) kez daha"
    }
  }

  /// Widget'lar için kısa durum (src/domain/labels.ts → shortStatus).
  static func shortStatus(_ schedule: ZKSchedule, _ s: ZKStatus, today: Int) -> String {
    if s.doneToday { return "Tamamlandı" }
    switch schedule {
    case .days:
      if !s.scheduledToday { return "İzin günü" }
      if s.state == "broken" { return "Zincir kırıldı" }
      if s.state == "pending" { return s.graceUsed ? "Bugün kaçırma!" : "Bugün yap" }
      return "Başla"
    case .interval:
      if s.state == "broken" { return "Zincir kırıldı" }
      if s.state == "new" { return "Başla" }
      if s.dueToday { return "Bugün son gün" }
      let left = s.nextDue.flatMap(DayMath.epochDay).map { $0 - today } ?? 0
      return left == 1 ? "En geç yarın" : "\(left) gün süren var"
    case .weekly:
      let week = s.week ?? ZKWeek(done: 0, target: 1, daysLeft: 0)
      return "Bu hafta \(week.done)/\(week.target)"
    }
  }

  /// Akşam hatırlatması (src/domain/labels.ts → reminderContent).
  static func reminder(_ items: [(name: String, emoji: String, schedule: ZKSchedule, status: ZKStatus)]) -> (title: String, body: String)? {
    let waiting = items.filter { ChainLogic.countsToday($0.schedule, $0.status) && !$0.status.doneToday }
    if waiting.isEmpty { return nil }
    if waiting.count == 1 {
      let item = waiting[0]
      let body: String
      if item.status.graceUsed { body = "Bugün yaptın mı? Hata payını kullandın, bugün kaçırırsan zincir kırılır." }
      else if item.status.streak > 0 { body = "Bugün yaptın mı? \(item.status.streak) \(chainLengthLabel(item.status.unit)) kırılmasın." }
      else { body = "Bugün yaptın mı? Zincire bir halka eklemek için harika bir gün." }
      return ("\(item.emoji) \(item.name)", body)
    }
    let names = waiting.map { $0.name }
    let shown = names.count > 3
      ? "\(names.prefix(2).joined(separator: ", ")) ve \(names.count - 2) zincir daha"
      : "\(names.dropLast().joined(separator: ", ")) ve \(names[names.count - 1])"
    let risky = waiting.filter { $0.status.graceUsed }.map { $0.name }
    let warning = risky.isEmpty ? "" : " \(risky.joined(separator: ", ")) için hata payın kalmadı."
    return ("Bugün \(waiting.count) zincir seni bekliyor", "\(shown). Zinciri kırma!\(warning)")
  }

  /// "Salı, 29 Eylül"
  static func longDate(_ day: Int) -> String {
    let c = DayMath.civil(day)
    return "\(weekdayNames[DayMath.weekday(day)]), \(c.day) \(monthNames[c.month - 1])"
  }

  /// "Sal, 29 Eyl"
  static func mediumDate(_ day: Int) -> String {
    let c = DayMath.civil(day)
    return "\(weekdayShort[DayMath.weekday(day)]), \(c.day) \(monthShort[c.month - 1])"
  }

  /// "29 Eyl"
  static func shortDate(_ day: Int) -> String {
    let c = DayMath.civil(day)
    return "\(c.day) \(monthShort[c.month - 1])"
  }
}

// MARK: - Hatırlatma planı

/// src/notifications/plan.ts → planReminders ile aynı.
struct ZKPlannedReminder: Equatable {
  let id: String
  let day: String
  let at: Date
  let title: String
  let body: String
}

enum ReminderPlanner {
  static let prefix = "zk-reminder-"
  static let days = 14

  static func reminderTime(day: Int, hour: Int, minute: Int, dayStartHour: Int, calendar: Calendar = DayMath.gregorian) -> Date {
    let c = DayMath.civil(day + (hour < dayStartHour ? 1 : 0))
    var comps = DateComponents()
    comps.year = c.year
    comps.month = c.month
    comps.day = c.day
    comps.hour = hour
    comps.minute = minute
    comps.second = 0
    return calendar.date(from: comps) ?? Date.distantFuture
  }

  static func plan(habits: [ZKHabit], settings: ZKSettings, now: Date) -> [ZKPlannedReminder] {
    guard settings.reminderEnabled, !habits.isEmpty else { return [] }
    let today = DayMath.today(now, dayStartHour: settings.dayStartHour)
    var out: [ZKPlannedReminder] = []
    for i in 0..<days {
      let day = today + i
      let at = reminderTime(day: day, hour: settings.reminderHour, minute: settings.reminderMinute, dayStartHour: settings.dayStartHour)
      if at <= now { continue }
      let items = habits.map { h in
        (name: h.name, emoji: h.emoji, schedule: h.schedule, status: ChainLogic.status(h, today: day, grace: settings.grace))
      }
      if let content = ZKText.reminder(items) {
        let key = DayMath.key(day)
        out.append(ZKPlannedReminder(id: prefix + key, day: key, at: at, title: content.title, body: content.body))
      }
    }
    return out
  }
}
