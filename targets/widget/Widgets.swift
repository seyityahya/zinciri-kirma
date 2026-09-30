import AppIntents
import SwiftUI
import WidgetKit

@main
struct ZincirWidgetBundle: WidgetBundle {
  var body: some Widget {
    HabitWidget()
    TodayWidget()
  }
}

// MARK: - Ortak

struct HabitItem: Identifiable {
  let habit: ZKHabit
  let status: ZKStatus
  let slots: [ZKSlot]
  let shortText: String
  /// Bu girdinin gösterdiği gün (YYYY-MM-DD).
  let dayKey: String
  var id: String { habit.id }

  /// Bu girdinin gösterdiği mantıksal gün.
  let today: Int

  init(habit: ZKHabit, today: Int, grace: Bool = ZKSettings.current.grace) {
    self.habit = habit
    self.today = today
    dayKey = DayMath.key(today)
    status = ChainLogic.status(habit, today: today, grace: grace)
    slots = ChainLogic.recentSlots(habit, today: today, count: 7, grace: grace)
    shortText = ZKText.shortStatus(habit.schedule, status, today: today)
  }

  static func sample(today: Int) -> HabitItem {
    let completions = (1...11).map { DayMath.key(today - $0) }
    let habit = ZKHabit(
      id: "sample",
      name: "Kitap oku",
      emoji: "📚",
      color: "#FF6B3D",
      schedule: .days(ZKSchedule.allDays),
      startDate: DayMath.key(today - 14),
      completions: completions
    )
    return HabitItem(habit: habit, today: today)
  }

  static func samples(today: Int) -> [HabitItem] {
    let a = sample(today: today)
    let b = ZKHabit(id: "s2", name: "Koşu", emoji: "🏃", color: "#34C759", schedule: .weekly(3), startDate: DayMath.key(today - 30), completions: (0...20).filter { $0 % 2 == 0 }.map { DayMath.key(today - $0) })
    let c = ZKHabit(id: "s3", name: "Su iç", emoji: "💧", color: "#2E9BF0", schedule: .interval(2), startDate: DayMath.key(today - 10), completions: [DayMath.key(today - 1), DayMath.key(today - 3)])
    return [a, HabitItem(habit: b, today: today), HabitItem(habit: c, today: today)]
  }
}

/// Şimdi ve sonraki üç gün değişimi (varsayılan 03:00): gün değişince widget kendiliğinden yenilenir.
func timelineDates(from now: Date, dayStartHour: Int) -> [Date] {
  var dates = [now]
  var cursor = now
  for _ in 0..<3 {
    let next = DayMath.nextBoundary(after: cursor, dayStartHour: dayStartHour)
    dates.append(next.addingTimeInterval(1))
    cursor = next.addingTimeInterval(1)
  }
  return dates
}

/// Zincir halkaları: yan yana geçmiş küçük halkalar.
struct MiniChain: View {
  let slots: [ZKSlot]
  let tint: Color
  var linkWidth: CGFloat = 13
  var linkHeight: CGFloat = 8

  var body: some View {
    HStack(spacing: -3) {
      ForEach(Array(slots.enumerated()), id: \.offset) { _, slot in
        Capsule(style: .continuous)
          .strokeBorder(color(for: slot), style: StrokeStyle(lineWidth: 2.2, dash: slot.state == "pending" ? [2.4, 1.8] : []))
          .frame(width: linkWidth, height: linkHeight)
      }
    }
    .accessibilityHidden(true)
  }

  private func color(for slot: ZKSlot) -> Color {
    switch slot.state {
    case "done": return tint
    case "forgiven": return ZKTheme.warning
    case "missed": return ZKTheme.danger.opacity(0.75)
    case "pending": return tint.opacity(0.55)
    default: return ZKTheme.emptyLink
    }
  }
}

struct EmptyStateView: View {
  var compact = false

  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "link")
        .font(.system(size: compact ? 20 : 26, weight: .bold))
        .foregroundStyle(ZKTheme.flame)
      Text("Henüz zincir yok")
        .font(.system(size: compact ? 13 : 15, weight: .bold, design: .rounded))
      Text("Uygulamayı açıp ilk zincirini oluştur")
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(URL(string: "zincirikirma://"))
  }
}

struct CheckButton: View {
  let item: HabitItem
  var size: CGFloat = 30

  var body: some View {
    let done = item.status.doneToday
    let tint = item.habit.tint
    Button(intent: ToggleHabitIntent(habitId: item.habit.id, day: item.dayKey)) {
      ZStack {
        Circle()
          .fill(done ? tint : tint.opacity(0.12))
        Circle()
          .strokeBorder(done ? Color.clear : tint.opacity(0.55), lineWidth: 2)
        Image(systemName: "checkmark")
          .font(.system(size: size * 0.42, weight: .heavy))
          .foregroundStyle(done ? Color.white : tint.opacity(0.35))
      }
      .frame(width: size, height: size)
      .widgetAccentable()
    }
    .buttonStyle(.plain)
    .invalidatableContent()
    .accessibilityLabel(done ? "\(item.habit.name) tamamlandı, geri al" : "\(item.habit.name) yaptım olarak işaretle")
  }
}

// MARK: - Tek zincir widget'ı

struct HabitEntry: TimelineEntry {
  let date: Date
  let item: HabitItem?
}

struct HabitProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> HabitEntry {
    HabitEntry(date: Date(), item: .sample(today: DayMath.today()))
  }

  func snapshot(for configuration: SelectHabitIntent, in context: Context) async -> HabitEntry {
    let entry = makeEntry(configuration, date: Date(), snap: SharedStore.snapshot())
    if entry.item == nil && context.isPreview { return placeholder(in: context) }
    return entry
  }

  func timeline(for configuration: SelectHabitIntent, in context: Context) async -> Timeline<HabitEntry> {
    let snap = SharedStore.snapshot()
    let entries = timelineDates(from: Date(), dayStartHour: snap.settings.dayStartHour).map {
      makeEntry(configuration, date: $0, snap: snap)
    }
    return Timeline(entries: entries, policy: .atEnd)
  }

  private func makeEntry(_ configuration: SelectHabitIntent, date: Date, snap: SharedStore.Snapshot) -> HabitEntry {
    let habits = snap.habits
    let selected = configuration.habit.flatMap { entity in habits.first { $0.id == entity.id } } ?? habits.first
    let today = DayMath.today(date, dayStartHour: snap.settings.dayStartHour)
    return HabitEntry(date: date, item: selected.map { HabitItem(habit: $0, today: today, grace: snap.settings.grace) })
  }
}

struct HabitWidgetView: View {
  let entry: HabitEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    Group {
      if let item = entry.item {
        switch family {
        case .accessoryCircular: CircularView(item: item)
        case .accessoryRectangular: RectangularView(item: item)
        case .accessoryInline: InlineView(item: item)
        default: SmallHabitView(item: item)
        }
      } else {
        switch family {
        case .accessoryCircular:
          ZStack {
            AccessoryWidgetBackground()
            Image(systemName: "link").font(.system(size: 18, weight: .bold))
          }
        case .accessoryRectangular, .accessoryInline:
          Text("Zinciri Kırma: zincir ekle")
        default:
          EmptyStateView(compact: true)
        }
      }
    }
    .containerBackground(for: .widget) {
      if family == .systemSmall { ZKTheme.background } else { Color.clear }
    }
  }
}

struct SmallHabitView: View {
  let item: HabitItem

  var body: some View {
    let status = item.status
    let tint = item.habit.tint
    let done = status.doneToday
    let restDay = !status.scheduledToday && !done

    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .top, spacing: 6) {
        Text(item.habit.emoji)
          .font(.system(size: 18))
          .frame(width: 32, height: 32)
          .background(tint.opacity(0.16), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        Spacer(minLength: 2)
        VStack(alignment: .trailing, spacing: 1) {
          Text(ZKText.weekdayShort[DayMath.weekday(item.today)])
            .font(.system(size: 11, weight: .bold, design: .rounded))
            .foregroundStyle(status.graceUsed && !done ? ZKTheme.warning : ZKTheme.flame)
          Text(ZKText.shortDate(item.today))
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .foregroundStyle(.secondary)
        }
        .lineLimit(1)
        .accessibilityLabel(ZKText.longDate(item.today))
      }

      Spacer(minLength: 4)

      HStack(alignment: .firstTextBaseline, spacing: 3) {
        Image(systemName: "flame.fill")
          .font(.system(size: 14, weight: .bold))
          .foregroundStyle(status.streak > 0 ? ZKTheme.flame : Color.secondary)
        Text("\(status.streak)")
          .font(.system(size: 30, weight: .bold, design: .rounded))
          .contentTransition(.numericText())
          .widgetAccentable()
        Text(ZKText.unitLabel(status.unit))
          .font(.system(size: 13, weight: .semibold, design: .rounded))
          .foregroundStyle(.secondary)
        Spacer(minLength: 2)
        MiniChain(slots: Array(item.slots.suffix(3)), tint: tint, linkWidth: 11, linkHeight: 7)
          .alignmentGuide(.firstTextBaseline) { d in d[VerticalAlignment.center] + 4 }
      }
      .lineLimit(1)
      .minimumScaleFactor(0.7)

      Text(item.habit.name)
        .font(.system(size: 13, weight: .semibold))
        .lineLimit(1)

      Spacer(minLength: 6)

      Button(intent: ToggleHabitIntent(habitId: item.habit.id, day: item.dayKey)) {
        HStack(spacing: 5) {
          Image(systemName: done ? "checkmark.circle.fill" : (restDay ? "moon.zzz.fill" : "circle"))
          Text(done ? "Yapıldı" : (restDay ? "İzin günü" : "Yaptım"))
        }
        .font(.system(size: 13, weight: .bold, design: .rounded))
        .lineLimit(1)
        .frame(maxWidth: .infinity, minHeight: 30)
        .foregroundStyle(done ? Color.white : tint)
        .background(done ? tint : tint.opacity(restDay ? 0.08 : 0.15), in: Capsule())
        .widgetAccentable()
      }
      .buttonStyle(.plain)
      .invalidatableContent()
      .accessibilityLabel(done ? "Tamamlandı, geri al" : "Bugün yaptım olarak işaretle")
    }
    .widgetURL(item.habit.deepLink)
  }
}

struct CircularView: View {
  let item: HabitItem

  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: -1) {
        Image(systemName: item.status.doneToday ? "checkmark" : "flame.fill")
          .font(.system(size: 11, weight: .bold))
        Text("\(item.status.streak)")
          .font(.system(size: 20, weight: .bold, design: .rounded))
          .minimumScaleFactor(0.5)
          .lineLimit(1)
      }
      .padding(4)
    }
    .widgetAccentable()
    .widgetURL(item.habit.deepLink)
  }
}

struct RectangularView: View {
  let item: HabitItem

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text("\(item.habit.emoji) \(item.habit.name)")
        .font(.system(size: 14, weight: .bold))
        .lineLimit(1)
        .widgetAccentable()
      HStack(spacing: 4) {
        Image(systemName: "flame.fill")
        Text("\(item.status.streak) \(ZKText.unitLabel(item.status.unit))")
        if item.status.doneToday {
          Image(systemName: "checkmark.circle.fill")
        }
      }
      .font(.system(size: 13, weight: .semibold, design: .rounded))
      Text(item.shortText)
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .widgetURL(item.habit.deepLink)
  }
}

struct InlineView: View {
  let item: HabitItem

  var body: some View {
    Text("🔥 \(item.status.streak) \(ZKText.unitLabel(item.status.unit)) · \(item.habit.name)")
      .widgetURL(item.habit.deepLink)
  }
}

struct HabitWidget: Widget {
  let kind = "HabitWidget"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind: kind, intent: SelectHabitIntent.self, provider: HabitProvider()) { entry in
      HabitWidgetView(entry: entry)
    }
    .configurationDisplayName("Tek Zincir")
    .description("Seçtiğin zinciri ana ekrandan tek dokunuşla işaretle.")
    .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

// MARK: - Bugün widget'ı

struct TodayEntry: TimelineEntry {
  let date: Date
  let today: Int
  let items: [HabitItem]
}

struct TodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry {
    let today = DayMath.today()
    return TodayEntry(date: Date(), today: today, items: HabitItem.samples(today: today))
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    let entry = makeEntry(date: Date(), snap: SharedStore.snapshot())
    completion(entry.items.isEmpty && context.isPreview ? placeholder(in: context) : entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    let snap = SharedStore.snapshot()
    let entries = timelineDates(from: Date(), dayStartHour: snap.settings.dayStartHour).map {
      makeEntry(date: $0, snap: snap)
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }

  private func makeEntry(date: Date, snap: SharedStore.Snapshot) -> TodayEntry {
    let today = DayMath.today(date, dayStartHour: snap.settings.dayStartHour)
    return TodayEntry(date: date, today: today, items: snap.habits.map { HabitItem(habit: $0, today: today, grace: snap.settings.grace) })
  }
}

struct TodayWidgetView: View {
  let entry: TodayEntry
  @Environment(\.widgetFamily) private var family

  private var maxRows: Int { family == .systemLarge ? 6 : 3 }

  var body: some View {
    Group {
      if entry.items.isEmpty {
        EmptyStateView()
      } else {
        content
      }
    }
    .containerBackground(for: .widget) { ZKTheme.background }
  }

  private var content: some View {
    let relevant = entry.items.filter { ChainLogic.countsToday($0.habit.schedule, $0.status) }
    let doneCount = relevant.filter { $0.status.doneToday }.count
    let visible = Array(entry.items.prefix(maxRows))
    let large = family == .systemLarge

    return VStack(alignment: .leading, spacing: large ? 10 : 6) {
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        Text("Bugün")
          .font(.system(size: large ? 17 : 14, weight: .bold, design: .rounded))
        Text(large ? ZKText.longDate(entry.today) : ZKText.shortDate(entry.today))
          .font(.system(size: large ? 13 : 12, weight: .medium))
          .foregroundStyle(.secondary)
        Spacer(minLength: 4)
        ProgressBadge(done: doneCount, total: relevant.count)
      }

      ForEach(visible) { item in
        TodayRow(item: item, large: large)
      }

      if entry.items.count > visible.count {
        Link(destination: URL(string: "zincirikirma://")!) {
          Text("+\(entry.items.count - visible.count) zincir daha")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.secondary)
        }
      }
      Spacer(minLength: 0)
    }
  }
}

struct ProgressBadge: View {
  let done: Int
  let total: Int

  var body: some View {
    let fraction = total > 0 ? Double(done) / Double(total) : 0
    HStack(spacing: 5) {
      ZStack {
        Circle().stroke(ZKTheme.track, lineWidth: 3)
        Circle()
          .trim(from: 0, to: fraction)
          .stroke(ZKTheme.flame, style: StrokeStyle(lineWidth: 3, lineCap: .round))
          .rotationEffect(.degrees(-90))
          .widgetAccentable()
      }
      .frame(width: 14, height: 14)
      Text(total > 0 ? "\(done)/\(total)" : "İzin")
        .font(.system(size: 12, weight: .bold, design: .rounded))
        .monospacedDigit()
    }
  }
}

struct TodayRow: View {
  let item: HabitItem
  let large: Bool

  var body: some View {
    let tint = item.habit.tint
    let size: CGFloat = large ? 34 : 28
    HStack(spacing: 9) {
      Link(destination: item.habit.deepLink ?? URL(string: "zincirikirma://")!) {
        HStack(spacing: 9) {
          Text(item.habit.emoji)
            .font(.system(size: large ? 17 : 14))
            .frame(width: size, height: size)
            .background(tint.opacity(0.16), in: RoundedRectangle(cornerRadius: large ? 10 : 8, style: .continuous))
          VStack(alignment: .leading, spacing: 0) {
            Text(item.habit.name)
              .font(.system(size: large ? 14 : 13, weight: .semibold))
              .lineLimit(1)
            Text(item.shortText)
              .font(.system(size: 11, weight: .medium))
              .foregroundStyle(.secondary)
              .lineLimit(1)
          }
          Spacer(minLength: 4)
          if large {
            MiniChain(slots: Array(item.slots.suffix(5)), tint: tint, linkWidth: 11, linkHeight: 7)
          }
          HStack(spacing: 2) {
            Image(systemName: "flame.fill")
              .font(.system(size: 10, weight: .bold))
            Text("\(item.status.streak)")
              .font(.system(size: 13, weight: .bold, design: .rounded))
              .monospacedDigit()
              .contentTransition(.numericText())
          }
          .foregroundStyle(item.status.streak > 0 ? ZKTheme.flame : Color.secondary)
        }
      }
      CheckButton(item: item, size: size)
    }
  }
}

struct TodayWidget: Widget {
  let kind = "TodayWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TodayProvider()) { entry in
      TodayWidgetView(entry: entry)
    }
    .configurationDisplayName("Bugün")
    .description("Tüm zincirlerini tek bakışta gör ve işaretle.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
