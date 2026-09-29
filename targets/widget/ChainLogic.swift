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

  /// Yerel saate göre bugünün epoch günü.
  static func today(_ date: Date = Date(), calendar: Calendar = DayMath.gregorian) -> Int {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return daysFromCivil(c.year ?? 1970, c.month ?? 1, c.day ?? 1)
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

enum ChainLogic {
  private static func prepare(_ habit: ZKHabit, _ today: Int) -> Prepared {
    let days = Array(Set(habit.completions.compactMap(DayMath.epochDay).filter { $0 <= today })).sorted()
    let start = min(DayMath.epochDay(habit.startDate) ?? today, today)
    let first = days.first
    return Prepared(today: today, days: days, set: Set(days), first: first, origin: min(start, first ?? Int.max))
  }

  private static func stateOf(_ streak: Int, _ best: Int, _ due: Bool) -> String {
    if streak > 0 { return due ? "pending" : "active" }
    return best > 0 ? "broken" : "new"
  }

  static func status(_ habit: ZKHabit, today: Int) -> ZKStatus {
    let p = prepare(habit, today)
    switch habit.schedule {
    case .days(let days): return daysStatus(Set(days), p)
    case .interval(let every): return intervalStatus(every, p)
    case .weekly(let times): return weeklyStatus(habit, times, p)
    }
  }

  // Haftanın belirli günleri
  private static func daysStatus(_ planned: Set<Int>, _ p: Prepared) -> ZKStatus {
    let t = p.today
    func isPlanned(_ d: Int) -> Bool { planned.contains(DayMath.weekday(d)) }

    var streak = 0
    var chainStart: Int? = nil
    var best = 0
    if let first = p.first {
      var d = t
      while d >= first {
        if isPlanned(d) {
          if p.set.contains(d) {
            streak += 1
            chainStart = d
          } else if d != t {
            break
          }
        }
        d -= 1
      }

      var run = 0
      var e = first
      while e <= t {
        if isPlanned(e) {
          if p.set.contains(e) {
            run += 1
            best = max(best, run)
          } else if e != t {
            run = 0
          }
        }
        e += 1
      }
    }

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
    return ZKStatus(
      streak: streak,
      best: best,
      total: p.days.count,
      unit: "day",
      doneToday: doneToday,
      scheduledToday: scheduledToday,
      dueToday: dueToday,
      state: stateOf(streak, best, dueToday),
      chainStart: chainStart.map(DayMath.key),
      nextDue: nextDue.map(DayMath.key),
      week: nil,
      weekLost: false,
      successRate: plannedCount > 0 ? Double(doneCount) / Double(plannedCount) : nil
    )
  }

  // N günde bir
  private static func intervalStatus(_ every: Int, _ p: Prepared) -> ZKStatus {
    let t = p.today
    let list = p.days
    var best = 0
    var run = 0
    for i in list.indices {
      run = (i > 0 && list[i] - list[i - 1] <= every) ? run + 1 : 1
      best = max(best, run)
    }

    var streak = 0
    var chainStart: Int? = nil
    var nextDue: Int? = nil
    let last = list.last
    let alive = last.map { t - $0 <= every } ?? false
    if alive, let last {
      streak = 1
      var i = list.count - 1
      while i > 0 && list[i] - list[i - 1] <= every {
        streak += 1
        i -= 1
      }
      chainStart = list[i]
      nextDue = last + every
    }

    let doneToday = last == t
    let dueToday = alive && !doneToday && nextDue == t
    return ZKStatus(
      streak: streak,
      best: best,
      total: list.count,
      unit: "time",
      doneToday: doneToday,
      scheduledToday: true,
      dueToday: dueToday,
      state: stateOf(streak, best, dueToday),
      chainStart: chainStart.map(DayMath.key),
      nextDue: nextDue.map(DayMath.key),
      week: nil,
      weekLost: false,
      successRate: nil
    )
  }

  // Haftada N kez
  private struct WeeklyContext {
    let times: Int
    let startWeek: Int
    let startWeekday: Int
    let p: Prepared

    func count(_ weekStart: Int) -> Int {
      var c = 0
      var d = weekStart
      while d < weekStart + 7 && d <= p.today {
        if p.set.contains(d) { c += 1 }
        d += 1
      }
      return c
    }

    func target(_ weekStart: Int) -> Int {
      weekStart == startWeek ? min(times, 7 - startWeekday) : times
    }

    func satisfied(_ weekStart: Int) -> Bool { count(weekStart) >= target(weekStart) }
  }

  private static func weeklyContext(_ habit: ZKHabit, _ times: Int, _ p: Prepared) -> WeeklyContext {
    let start = min(DayMath.epochDay(habit.startDate) ?? p.today, p.today)
    return WeeklyContext(times: times, startWeek: DayMath.weekStart(start), startWeekday: DayMath.weekday(start), p: p)
  }

  private static func weeklyStatus(_ habit: ZKHabit, _ times: Int, _ p: Prepared) -> ZKStatus {
    let t = p.today
    let ctx = weeklyContext(habit, times, p)
    let current = DayMath.weekStart(t)

    var streak = 0
    var chainStart: Int? = nil
    if ctx.satisfied(current) {
      streak = 1
      chainStart = current
    }
    var best = 0
    if let first = p.first {
      var w = current - 7
      while w + 6 >= first {
        if !ctx.satisfied(w) { break }
        streak += 1
        chainStart = w
        w -= 7
      }

      var run = 0
      var x = DayMath.weekStart(first)
      while x <= current {
        if ctx.satisfied(x) {
          run += 1
          best = max(best, run)
        } else if x != current {
          run = 0
        }
        x += 7
      }
    }

    var weeksCounted = 0
    var weeksDone = 0
    var y = DayMath.weekStart(p.origin)
    while y <= current {
      let ok = ctx.satisfied(y)
      if !(y == current && !ok) {
        weeksCounted += 1
        if ok { weeksDone += 1 }
      }
      y += 7
    }

    let done = ctx.count(current)
    let target = ctx.target(current)
    let doneToday = p.set.contains(t)
    let weekday = DayMath.weekday(t)
    let needed = max(0, target - done)
    let available = doneToday ? 6 - weekday : 7 - weekday
    let weekLost = needed > available
    let dueToday = !doneToday && needed > 0 && needed == available
    return ZKStatus(
      streak: streak,
      best: best,
      total: p.days.count,
      unit: "week",
      doneToday: doneToday,
      scheduledToday: true,
      dueToday: dueToday,
      state: stateOf(streak, best, dueToday),
      chainStart: chainStart.map(DayMath.key),
      nextDue: nil,
      week: ZKWeek(done: done, target: target, daysLeft: 7 - weekday),
      weekLost: weekLost,
      successRate: weeksCounted > 0 ? Double(weeksDone) / Double(weeksCounted) : nil
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

  static func recentSlots(_ habit: ZKHabit, today: Int, count: Int) -> [ZKSlot] {
    let p = prepare(habit, today)
    let t = p.today
    var slots: [ZKSlot] = []

    switch habit.schedule {
    case .days(let days):
      let planned = Set(days)
      var d = t
      while slots.count < count && d > t - count * 7 - 7 {
        if planned.contains(DayMath.weekday(d)) {
          let state: String
          if d == t { state = p.set.contains(d) ? "done" : "pending" }
          else if p.set.contains(d) { state = "done" }
          else if d < p.origin { state = "empty" }
          else { state = "missed" }
          slots.append(ZKSlot(key: DayMath.key(d), state: state))
        }
        d -= 1
      }
      slots.reverse()

    case .weekly(let times):
      let ctx = weeklyContext(habit, times, p)
      let current = DayMath.weekStart(t)
      let originWeek = DayMath.weekStart(p.origin)
      for i in stride(from: count - 1, through: 0, by: -1) {
        let w = current - i * 7
        let progress = min(1, Double(ctx.count(w)) / Double(ctx.target(w)))
        let state: String
        if w < originWeek { state = "empty" }
        else if progress >= 1 { state = "done" }
        else if w == current { state = "pending" }
        else { state = "missed" }
        slots.append(ZKSlot(key: DayMath.key(w), state: state, progress: progress))
      }

    case .interval(let every):
      let list = p.days
      var seq: [ZKSlot] = []
      for i in list.indices {
        if i > 0 && list[i] - list[i - 1] > every {
          seq.append(ZKSlot(key: "miss-\(DayMath.key(list[i - 1] + every + 1))", state: "missed"))
        }
        seq.append(ZKSlot(key: DayMath.key(list[i]), state: "done"))
      }
      if let last = list.last {
        if t - last > every {
          seq.append(ZKSlot(key: "miss-\(DayMath.key(last + every + 1))", state: "missed"))
          seq.append(ZKSlot(key: "next", state: "pending"))
        } else if last != t {
          seq.append(ZKSlot(key: "next", state: "pending"))
        }
      } else {
        seq.append(ZKSlot(key: "next", state: "pending"))
      }
      slots.append(contentsOf: seq.suffix(count))
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
      if s.state == "pending" { return "Zinciri korumak için bugün yap" }
      if s.state == "broken" { return "Zincir kırıldı · bugün yeniden başla" }
      return "İlk halkayı bugün ekle"
    case .interval:
      if s.doneToday { return "Bugün tamamlandı" }
      if s.state == "broken" { return "Zincir kırıldı · yeniden başla" }
      if s.state == "new" { return "İlk halkayı ekle" }
      if s.dueToday { return "Bugün son gün!" }
      let left = s.nextDue.flatMap(DayMath.epochDay).map { $0 - today } ?? 0
      return left == 1 ? "En geç yarın yap" : "En geç \(left) gün içinde yap"
    case .weekly(let times):
      let week = s.week ?? ZKWeek(done: 0, target: times, daysLeft: 0)
      let progress = "Bu hafta \(week.done)/\(week.target)"
      let needed = week.target - week.done
      if needed <= 0 { return "\(progress) · hedef tamam" }
      if s.weekLost { return "\(progress) · hedef kaçtı" }
      if s.dueToday { return "\(progress) · bugün şart" }
      if s.state == "broken" && week.done == 0 { return "Zincir kırıldı · bu hafta yeniden başla" }
      return "\(progress) · \(needed) kez daha"
    }
  }

  /// Widget'lar için kısa durum: "Bugün tamamlandı" yerine "Tamamlandı" gibi.
  static func shortStatus(_ schedule: ZKSchedule, _ s: ZKStatus, today: Int) -> String {
    if s.doneToday { return "Tamamlandı" }
    switch schedule {
    case .days:
      if !s.scheduledToday { return "İzin günü" }
      if s.state == "broken" { return "Zincir kırıldı" }
      return s.state == "pending" ? "Bugün yap" : "Başla"
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

  /// "Salı, 29 Eylül"
  static func longDate(_ day: Int) -> String {
    let c = DayMath.civil(day)
    return "\(weekdayNames[DayMath.weekday(day)]), \(c.day) \(monthNames[c.month - 1])"
  }

  /// "29 Eyl"
  static func shortDate(_ day: Int) -> String {
    let c = DayMath.civil(day)
    return "\(c.day) \(monthShort[c.month - 1])"
  }
}
