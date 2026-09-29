import AppIntents
import WidgetKit

/// Widget ayarlarında seçilebilen zincir.
struct HabitEntity: AppEntity {
  let id: String
  let name: String
  let emoji: String

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Zincir"
  static let defaultQuery = HabitQuery()

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(emoji) \(name)")
  }

  init(habit: ZKHabit) {
    id = habit.id
    name = habit.name
    emoji = habit.emoji
  }
}

struct HabitQuery: EntityQuery {
  func entities(for identifiers: [HabitEntity.ID]) async throws -> [HabitEntity] {
    SharedStore.loadHabits().filter { identifiers.contains($0.id) }.map(HabitEntity.init(habit:))
  }

  func suggestedEntities() async throws -> [HabitEntity] {
    SharedStore.loadHabits().map(HabitEntity.init(habit:))
  }

  func defaultResult() async -> HabitEntity? {
    SharedStore.loadHabits().first.map(HabitEntity.init(habit:))
  }
}

struct SelectHabitIntent: WidgetConfigurationIntent {
  static let title: LocalizedStringResource = "Zincir seç"
  static let description = IntentDescription("Widget'ta hangi zincirin görüneceğini seç.")

  @Parameter(title: "Zincir")
  var habit: HabitEntity?

  init() {}

  init(habit: HabitEntity?) {
    self.habit = habit
  }
}

/// Widget'taki "Yaptım" düğmesi. Uygulamayı açmadan bugünü işaretler/kaldırır.
struct ToggleHabitIntent: AppIntent {
  static let title: LocalizedStringResource = "Bugünü işaretle"
  static let isDiscoverable = false

  @Parameter(title: "Zincir")
  var habitId: String

  /// Widget'ın gösterdiği gün. Gece yarısından sonra widget henüz yenilenmediyse
  /// dünü gösteriyordur; o durumda yanlış günü işaretlemek yerine yalnızca yenilenir.
  @Parameter(title: "Gün")
  var day: String?

  init() {
    habitId = ""
  }

  init(habitId: String, day: String) {
    self.habitId = habitId
    self.day = day
  }

  func perform() async throws -> some IntentResult {
    let today = DayMath.key(DayMath.today())
    if day == nil || day == today {
      SharedStore.toggleToday(habitId: habitId)
    }
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}
