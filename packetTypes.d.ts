// Define Type Aliases For Easy YML Translation And Easy Fixes In Future
// These may be incorrect
export type ByteArray = Buffer
export type SignedByteArray = Buffer
export type LittleString = string
export type ShortArray = Buffer
export type varint = bigint
export type varint32 = number
export type varint64 = bigint
export type zigzag32 = number
export type zigzag64 = bigint
export type uuid = string
export type byterot = number
export type bitflags = any
export type restBuffer = any
export type encapsulated = any
export type nbt = any
export type lnbt = any
export type nbtLoop = any
export type enum_size_based_on_values_len = any
export type MapInfo = any

export type bool = boolean
export type i32 = number
export type u8 = number
export type lf32 = number
export type li16 = number
export type li32 = number
export type li64 = bigint
export type lu64 = bigint
export type lu32 = number
export type lu16 = number
export type i8 = number
export type u16 = number

export type vec3i = { x: zigzag32, y: zigzag32, z: zigzag32 }
export type vec3u = { x: varint, y: varint, z: varint }
export type vec3f = { x: lf32, y: lf32, z: lf32 }
export type vec2f = { x: lf32, z:lf32 }

export interface BehaviorPackInfo {
  uuid: uuid
  version: string
  size: lu64
  content_key: string
  sub_pack_name: string
  content_identity: string
  has_scripts: bool
}
export type BehaviorPackInfos = BehaviorPackInfo[]
export interface TexturePackInfo {
  uuid: uuid
  version: string
  size: lu64
  content_key: string
  sub_pack_name: string
  content_identity: string
  has_scripts: bool
  rtx_enabled: bool
}
export type TexturePackInfos = TexturePackInfo[]
export interface ResourcePackIdVersion {
   uuid: uuid
   version: string
   name: string
}
export type ResourcePackIdVersions= ResourcePackIdVersion[]
export type ResourcePackId = string
export type ResourcePackIds = ResourcePackId[]
export interface Experiment {
  name: string
  enabled: bool
}
export type Experiments = Experiment[]
export type GameMode = (
  "survival" |
  "creative" |
  "adventure" |
  "survival_spectator" |
  "creative_spectator" |
  "fallback"
)
export type GameRuleType = (
  "bool" | "int" | "float"
)
export interface GameRule {
  name: string
  editable: bool
  type: GameRuleType
  value: bool | zigzag32 | lf32
}
export type GameRules = GameRule[]
export interface Blob {
  hash: lu64
  payload: ByteArray
}
export interface BlockProperty {
  name: string
  state: nbt
}
export type BlockProperties = BlockProperty[]
export interface Itemstate {
  name: string
  runtime_id: li16
  component_based: bool
}
export type Itemstates = Itemstate[]
export interface ItemExtraDataNBT {
  version: u8
  nbt: lnbt
}
export interface ItemExtraDataWithBlockingTick {
  has_nbt: boolean
  nbt?: ItemExtraDataNBT
  can_place_on: ShortArray[]
  can_destroy: ShortArray[]
  blocking_tick: li64
}
export interface ItemExtraDataWithoutBlockingTick {
  has_nbt: boolean
  nbt?: ItemExtraDataNBT
  can_place_on: ShortArray[]
  can_destroy: ShortArray[]
}
export interface ItemLegacy {
  network_id: zigzag32
  count?: lu16
  metadata?: varint
  block_runtime_id: zigzag32
  extra?: ItemExtraDataWithBlockingTick | ItemExtraDataWithoutBlockingTick
}
export interface Item {
  network_id: zigzag32
  count?: lu16
  metadata?: varint
  has_stack_id?: u8
  stack_id?: zigzag32
  block_runtime_id: zigzag32
  extra?: ItemExtraDataWithBlockingTick | ItemExtraDataWithoutBlockingTick
}
export type MetadataDictionaryKey = (
  "flags" |
  "health" |
  "variant" |
  "color" |
  "nametag" |
  "owner_eid" |
  "target_eid" |
  "air" |
  "potion_color" |
  "potion_ambient" |
  "jump_duration" |
  "hurt_time" |
  "hurt_direction" |
  "paddle_time_left" |
  "paddle_time_right" |
  "experience_value" |
  "minecart_display_block" |
  "minecart_display_offset" |
  "minecart_has_display" |
  "old_swell" |
  "swell_dir" |
  "charge_amount" |
  "enderman_held_runtime_id" |
  "entity_age" |
  "player_flags" |
  "player_index" |
  "player_bed_position" |
  "fireball_power_x" |
  "fireball_power_y" |
  "fireball_power_z" |
  "aux_power" |
  "fish_x" |
  "fish_z" |
  "fish_angle" |
  "potion_aux_value" |
  "lead_holder_eid" |
  "scale" |
  "interactive_tag" |
  "npc_skin_id" |
  "url_tag" |
  "max_airdata_max_air" |
  "mark_variant" |
  "container_type" |
  "container_base_size" |
  "container_extra_slots_per_strength" |
  "block_target" |
  "wither_invulnerable_ticks" |
  "wither_target_1" |
  "wither_target_2" |
  "wither_target_3" |
  "aerial_attack" |
  "boundingbox_width" |
  "boundingbox_height" |
  "fuse_length" |
  "rider_seat_position" |
  "rider_rotation_locked" |
  "rider_max_rotation" |
  "rider_min_rotation" |
  "rider_rotation_offset" |
  "area_effect_cloud_radius" |
  "area_effect_cloud_waiting" |
  "area_effect_cloud_particle_id" |
  "shulker_peek_id" |
  "shulker_attach_face" |
  "shulker_attached" |
  "shulker_attach_pos" |
  "trading_player_eid" |
  "trading_career" |
  "has_command_block" |
  "command_block_command" |
  "command_block_last_output" |
  "command_block_track_output" |
  "controlling_rider_seat_number" |
  "strength" |
  "max_strength" |
  "spell_casting_color" |
  "limited_life" |
  "armor_stand_pose_index" |
  "ender_crystal_time_offset" |
  "always_show_nametag" |
  "color_2" |
  "name_author" |
  "score_tag" |
  "balloon_attached_entity" |
  "pufferfish_size" |
  "bubble_time" |
  "agent" |
  "sitting_amount" |
  "sitting_amount_previous" |
  "eating_counter" |
  "flags_extended" |
  "laying_amount" |
  "laying_amount_previous" |
  "duration" |
  "spawn_time" |
  "change_rate" |
  "change_on_pickup" |
  "pickup_count" |
  "interact_text" |
  "trade_tier" |
  "max_trade_tier" |
  "trade_experience" |
  "skin_id" |
  "spawning_frames" |
  "command_block_tick_delay" |
  "command_block_execute_on_first_tick" |
  "ambient_sound_interval" |
  "ambient_sound_interval_range" |
  "ambient_sound_event_name" |
  "fall_damage_multiplier" |
  "name_raw_text" |
  "can_ride_target" |
  "low_tier_cured_discount" |
  "high_tier_cured_discount" |
  "nearby_cured_discount" |
  "nearby_cured_discount_timestamp" |
  "hitbox" |
  "is_buoyant" |
  "base_runtime_id" |
  "freezing_effect_strength" |
  "buoyancy_data" |
  "goat_horn_count" |
  "update_properties"
)
export type MetadataDictionaryType = (
  "byte" |
  "short" |
  "int" |
  "float" |
  "string" |
  "compound" |
  "vec3i" |
  "long" |
  "vec3f"
)
export type MetadataDictionaryValue = (
  i8 |
  li16 |
  zigzag32 |
  lf32 |
  string |
  nbt |
  vec3i |
  zigzag64|
  vec3f |
  MetadataFlags1[] |
  MetadataFlags2[]
)
export type MetadataFlags1 = (
  "onfire" |
  "sneaking" |
  "riding" |
  "sprinting" |
  "action" |
  "invisible" |
  "tempted" |
  "inlove" |
  "saddled" |
  "powered" |
  "ignited" |
  "baby" |
  "converting" |
  "critical" |
  "can_show_nametag" |
  "always_show_nametag" |
  "no_ai" |
  "silent" |
  "wallclimbing" |
  "can_climb" |
  "swimmer" |
  "can_fly" |
  "walker" |
  "resting" |
  "sitting" |
  "angry" |
  "interested" |
  "charged" |
  "tamed" |
  "orphaned" |
  "leashed" |
  "sheared" |
  "gliding" |
  "elder" |
  "moving" |
  "breathing" |
  "chested" |
  "stackable" |
  "showbase" |
  "rearing" |
  "vibrating" |
  "idling" |
  "evoker_spell" |
  "charge_attack" |
  "wasd_controlled" |
  "can_power_jump" |
  "linger" |
  "has_collision" |
  "affected_by_gravity" |
  "fire_immune" |
  "dancing" |
  "enchanted" |
  "show_trident_rope" |
  "container_private" |
  "transforming" |
  "spin_attack" |
  "swimming" |
  "bribed" |
  "pregnant" |
  "laying_egg" |
  "rider_can_pick" |
  "transition_sitting" |
  "eating" |
  "laying_down"
)
export type MetadataFlags2 = (
  "sneezing" |
  "trusting" |
  "rolling" |
  "scared" |
  "in_scaffolding" |
  "over_scaffolding" |
  "fall_through_scaffolding" |
  "blocking" | 
  "transition_blocking" |
  "blocked_using_shield" |
  "blocked_using_damaged_shield" |
  "sleeping" |
  "wants_to_wake" |
  "trade_interest" |
  "door_breaker" | 
  "breaking_obstruction" |
  "door_opener" | 
  "illager_captain" |
  "stunned" |
  "roaring" |
  "delayed_attacking" |
  "avoiding_mobs" |
  "avoiding_block" |
  "facing_target_to_range_attack" |
  "hidden_when_invisible" | 
  "is_in_ui" |
  "stalking" |
  "emoting" |
  "celebrating" |
  "admiring" |
  "celebrating_special" |
  "unknown95" | 
  "ram_attack" |
  "playing_dead"
)
export interface MetadataDictionary {
  key: MetadataDictionaryKey
  type: MetadataDictionaryType
  value: MetadataDictionaryValue
}
export interface Link {
  ridden_entity_id: zigzag64
  rider_entity_id: zigzag64
  type: u8
  immediate: bool
  rider_initiated: bool
}
export type Links = Link[]
export interface EntityAttribute {
  name: string
  min: lf32
  value: lf32
  max: lf32
}
export type EntityAttributes = EntityAttribute[]
export interface Rotation {
  yaw: byterot
  pitch: byterot
  head_yaw: byterot
}
export interface BlockCoordinates {
  x: zigzag32
  y: zigzag32
  z: zigzag32
}
export interface PlayerAttribute {
  min: lf32
  max: lf32
  current: lf32
  default: lf32
  name: string
}
export type PlayerAttributes = PlayerAttribute[]
export type TransactionUseItemActionType = (
  "click_block" | "click_air" | "break_block"
)
export interface TransactionUseItem {
  action_type: TransactionUseItemActionType
  block_position: vec3i
  face: varint
  hotbar_slot: varint
  held_item: Item
  player_pos: vec3f
  click_pos: vec3f
  block_runtime_id: varint
}
export type TransactionActionSourceType = (
  "container" | "global" | "world_interaction" | "creative" | "craft_slot" | "craft"
)
export interface TransactionAction {
  source_type: TransactionActionSourceType
  inventory_id?: WindowIDVarint
  flags?: varint
  action?: varint
  slot: varint
  old_item: Item
  new_item: Item
}
export interface LegacyTransaction {
  container_id: u8
  changed_slots: LegacyTransactionChangedSlots[]
}
export interface LegacyTransactionChangedSlots {
  slot_id: u8
}
export type TransactionActions = TransactionAction[]
export interface TransactionLegacy {
  legacy_request_id: zigzag32
  legacy_transactions?: LegacyTransaction[]
}
export type TransactionType = (
  "normal" | "inventory_mismatch" | "item_use" | "item_use_on_entity" | "item_release"
)
export type TransactionDataUseOnEntityDataType = (
  "interact" |
  "attack"
)
export interface TransactionDataUseOnEntity {
  entity_runtime_id: varint64
  action_type: TransactionDataUseOnEntityDataType
  hotbar_slot: zigzag32
  held_item: Item
  player_pos: vec3f
  click_pos: vec3f
}
export type TransactionDataItemReleaseDataType = (
  "release" |
  "consume"
)
export interface TransactionDataItemRelease {
  action_type: TransactionDataItemReleaseDataType
  hotbar_slot: zigzag32
  held_item: Item
  head_pos: vec3f
}
export type TransactionData = (
  TransactionUseItem |
  TransactionDataUseOnEntity |
  TransactionDataItemRelease
)
export interface Transaction {
  legacy: TransactionLegacy
  transaction_type: TransactionType
  actions: TransactionActions
  transaction_data: TransactionData
}
export type ItemStacks = Item[]
export interface RecipeIngredient {
  network_id: zigzag32
  network_data?: zigzag32
  count?: zigzag32
}
export interface PotionTypeRecipe {
  input_item_id: zigzag32
  input_item_meta: zigzag32
  ingredient_id: zigzag32
  ingredient_meta: zigzag32
  output_item_id: zigzag32
  output_item_meta: zigzag32
}
export type PotionTypeRecipes = PotionTypeRecipe[]
export interface PotionContainerChangeRecipe {
  input_item_id: zigzag32
  ingredient_id: zigzag32
  output_item_id: zigzag32
}
export type PotionContainerChangeRecipes = PotionContainerChangeRecipe[]
export type RecipeType = (
  "shapeless" |
  "shaped" |
  "furnace" |
  "furnace_with_metadata" |
  "multi" |
  "shulker_box" |
  "shapeless_chemistry" |
  "shaped_chemistry" 
)
export interface RecipeShapeless {
  recipe_id: string
  input: RecipeIngredient[]
  output: ItemLegacy[]
  uuid: uuid
  block: string
  priority: zigzag32
  network_id: varint
}
export interface RecipeShaped {
  recipe_id: string
  width: zigzag32
  height: zigzag32
  input: RecipeIngredient[][]
  output: ItemLegacy[]
  uuid: uuid
  block: string
  priority: zigzag32
  network_id: varint
}
export interface RecipeFurnace {
  input_id: zigzag32
  output: ItemLegacy
  block: string
}
export interface RecipeFurnaceWithMetaData {
  input_id: zigzag32
  input_meta: zigzag32
  output: ItemLegacy
  block: string
}
export interface RecipeMulti {
  uuid: uuid
  network_id: varint
}
export type RecipeRecipe = ( // Best Type Name 2021
  RecipeShapeless |
  RecipeShaped |
  RecipeFurnace |
  RecipeFurnaceWithMetaData |
  RecipeMulti 
)
export interface Recipe {
  type: RecipeType
  recipe: RecipeRecipe
}
export interface SkinImage {
  width: li32
  height: li32
  data: ByteArray
}
export interface SkinAnimation {
  skin_image: SkinImage
  animation_type: li32
  animation_frames: lf32
  expression_type: lf32
}
export interface SkinPersonalPiece {
  piece_id: string
  piece_type: string
  pack_id: string
  is_default_piece: bool
  product_id: string
}
export interface SkinPieceTintColor {
  piece_type: string
  colors: string[]
}
export interface Skin {
  skin_id: string
  play_fab_id: string
  skin_resource_pack: string
  skin_data: SkinImage
  animations: SkinAnimation[]
  cape_data: SkinImage
  geometry_data: string
  animation_data: string
  premium: bool
  persona: bool
  cape_on_classic: bool
  cape_id: string
  full_skin_id: string
  arm_size: string
  skin_color: string
  personal_pieces: SkinPersonalPiece[]
  piece_tint_colors: SkinPieceTintColor[]
}
export type PlayerRecordsType = (
  "add" | "remove"
)
export interface PlayerRecordsRecord {
  uuid: uuid
  entity_unique_id?: zigzag64
  username?: string
  xbox_user_id?: string
  platform_chat_id?: string
  build_platform?: li32
  skin_data?: Skin
  is_teacher?: bool
  is_host?: bool
}
export interface PlayerRecords {
  type: PlayerRecordsType
  records_count: varint
  records: PlayerRecordsRecord[]
  verified?: bool[]
}
export interface Enchant {
  id: u8
  level: u8
}
export interface EnchantOption {
  cost: varint
  slot_flags: li32
  equip_enchants: Enchant[]
  held_enchants: Enchant[]
  self_enchants: Enchant[]
  name: string
  option_id: zigzag32
}
export type Action = (
  "start_break" |
  "abort_break" |
  "stop_break" |
  "get_updated_block" |
  "drop_item" |
  "start_sleeping" |
  "stop_sleeping" |
  "respawn" |
  "jump" |
  "start_sprint" |
  "stop_sprint" |
  "start_sneak" |
  "stop_sneak" |
  "creative_player_destroy_block" |
  "dimension_change_ack" |
  "start_glide" |
  "stop_glide" |
  "build_denied" |
  "crack_break" |
  "change_skin" |
  "set_enchatnment_seed" |
  "swimming" |
  "stop_swimming" |
  "start_spin_attack" |
  "stop_spin_attack" |
  "interact_block" |
  "predict_break" |
  "continue_break"
)
export type ContainerSlotType = (
  "anvil_input" |
  "anvil_material" |
  "anvil_result" |
  "smithing_table_input" |
  "smithing_table_material" |
  "smithing_table_result" |
  "armor" |
  "container" |
  "beacon_payment" |
  "brewing_input" |
  "brewing_result" |
  "brewing_fuel" |
  "hotbar_and_inventory" |
  "crafting_input" |
  "crafting_output" |
  "recipe_construction" |
  "recipe_nature" |
  "recipe_items" |
  "recipe_search" |
  "recipe_search_bar" |
  "recipe_equipment" |
  "enchanting_input" |
  "enchanting_lapis" |
  "furnace_fuel" |
  "furnace_ingredient" |
  "furnace_output" |
  "horse_equip" |
  "hotbar" |
  "inventory" |
  "shulker" |
  "trade_ingredient1" |
  "trade_ingredient2" |
  "trade_result" |
  "offhand" |
  "compcreate_input" |
  "compcreate_output" |
  "elemconstruct_output" |
  "matreduce_input" |
  "matreduce_output" |
  "labtable_input" |
  "loom_input" |
  "loom_dye" |
  "loom_material" |
  "loom_result" |
  "blast_furnace_ingredient" |
  "smoker_ingredient" |
  "trade2_ingredient1" |
  "trade2_ingredient2" |
  "trade2_result" |
  "grindstone_input" |
  "grindstone_additional" |
  "grindstone_result" |
  "stonecutter_input" |
  "stonecutter_result" |
  "cartography_input" |
  "cartography_additional" |
  "cartography_result" |
  "barrel" |
  "cursor" |
  "creative_output" 
)
export interface StackRequestSlotInfo {
  slot_type: ContainerSlotType
  slot: u8
  stack_id: zigzag32
}
export type ItemStackRequestActionType = (
  "take" |
  "place" |
  "swap" |
  "drop" |
  "destroy" |
  "consume" |
  "create" |
  "lab_table_combine" |
  "beacon_payment" |
  "mine_block" |
  "craft_recipe" |
  "craft_recipe_auto" |
  "craft_creative" |
  "optional" |
  "non_implemented" |
  "results_deprecated"
)
export interface ItemStackRequestAction {
  type_id: ItemStackRequestActionType
  count?: u8
  source?: StackRequestSlotInfo
  destination?: StackRequestSlotInfo
  randomly?: bool
  result_slot_id?: u8
  primary_effect?: zigzag32
  secondary_effect?: zigzag32
  unknown1?: zigzag32
  predicted_durability?: zigzag32
  network_id?: zigzag32 
  recipe_network_id?: varint
  item_id?: varint
  filtered_string_index?: li32
  result_items?: ItemLegacy[]
  times_crafted?: u8
}
export interface ItemStackRequest {
  request_id: varint
  actions: ItemStackRequestAction[]
  custom_names: string[]
}
export type ItemStackResponseStatus = (
  "ok" | "error"
)
export interface ItemStackResponseContainerSlot {
  slot: u8
  hotbar_slot: u8
  count: u8
  item_stack_id: varint
  custom_name: string
  durability_correction: zigzag32
}
export interface ItemStackResponseContainer {
  slot_type: ContainerSlotType
  slots: ItemStackResponseContainerSlot[]
}
export interface ItemStackResponse {
  status: ItemStackResponseStatus
  request_id: varint
  containers: ItemStackResponseContainer[]
}
export type ItemStackResponses = ItemStackResponse[]
export type Recipes = Recipe[]
export interface ItemComponent {
  name: string
  nbt: nbt
}
export type ItemComponentList = ItemComponent[]
export type CommandOriginType = (
  "player" |
  "block" |
  "minecart_block" |
  "dev_console" |
  "test" |
  "automation_player" |
  "client_automation" |
  "dedicated_server" |
  "entity" |
  "virtual" |
  "game_argument" |
  "entity_server" |
  "precompiled" |
  "game_director_entity_server" |
  "script" 
)
export interface CommandOrigin {
  type: CommandOriginType
  uuid: uuid
  request_id: string
  player_entity_id?: zigzag64
}
export type TrackedObjectType = (
  "entity" | "block"
)
export interface TrackedObject {
  type: TrackedObjectType
  entity_unique_id?: zigzag64
  block_position?: BlockCoordinates
}
export interface MapDecoration {
  type: u8
  rotation: u8
  x: u8
  y: u8
  label: string
  color_abgr: varint
}
export type StructureBlockSettingsRotation = (
  "none" |
  "90_deg" |
  "180_deg" |
  "270_deg"
)
export type StructureBlockSettingsMirror = (
  "none" |
  "x_axis" |
  "z_axis" |
  "both_axes"
)
export type StructureBlockSettingsAnimiationMode = (
  "none" |
  "layers" |
  "blocks"
)
export interface StructureBlockSettings {
  palette_name: string
  ignore_entities: bool
  ignore_blocks: bool
  size: BlockCoordinates
  structure_offset: BlockCoordinates
  last_editing_player_unique_id: zigzag64
  rotation: StructureBlockSettingsRotation
  mirror: StructureBlockSettingsMirror
  animation_mode: StructureBlockSettingsAnimiationMode
  animation_duration: lf32
  integrity: lf32
  seed: lu32
  pivot: vec3f
}
export type WindowID = (
  "drop_contents" |
  "beacon" |
  "trading_output" |
  "trading_use_inputs" |
  "trading_input_2" |
  "trading_input_1" |
  "enchant_output" |
  "enchant_material" |
  "enchant_input" |
  "anvil_output" |
  "anvil_result" |
  "anvil_material" |
  "container_input" |
  "crafting_use_ingredient" |
  "crafting_result" |
  "crafting_remove_ingredient" |
  "crafting_add_ingredient" |
  "none" |
  "inventory" |
  "first" |
  "last" |
  "offhand" |
  "armor" |
  "creative" |
  "hotbar" |
  "fixed_inventory" |
  "ui" 
)
export type WindowIDVarint = WindowID
export type WindowType = (
  "none" |
  "inventory" |
  "container" |
  "workbench" |
  "furnace" |
  "enchantment" |
  "brewing_stand" |
  "anvil" |
  "dispenser" |
  "dropper" |
  "hopper" |
  "cauldron" |
  "minecart_chest" |
  "minecart_hopper" |
  "horse" |
  "beacon" |
  "structure_editor" |
  "trading" |
  "command_block" |
  "jukebox" |
  "armor" |
  "hand" |
  "compound_creator" |
  "element_constructor" |
  "material_reducer" |
  "lab_table" |
  "loom" |
  "lectern" |
  "grindstone" |
  "blast_furnace" |
  "smoker" |
  "stonecutter" |
  "cartography" |
  "hud" |
  "jigsaw_editor" |
  "smithing_table" 
)
export type SoundType = (
  "ItemUseOn" |
  "Hit" |
  "Step" |
  "Fly" |
  "Jump" |
  "Break" |
  "Place" |
  "HeavyStep" |
  "Gallop" |
  "Fall" |
  "Ambient" |
  "AmbientBaby" |
  "AmbientInWater" |
  "Breathe" |
  "Death" |
  "DeathInWater" |
  "DeathToZombie" |
  "Hurt" |
  "HurtInWater" |
  "Mad" |
  "Boost" |
  "Bow" |
  "SquishBig" |
  "SquishSmall" |
  "FallBig" |
  "FallSmall" |
  "Splash" |
  "Fizz" |
  "Flap" |
  "Swim" |
  "Drink" |
  "Eat" |
  "Takeoff" |
  "Shake" |
  "Plop" |
  "Land" |
  "Saddle" |
  "Armor" |
  "MobArmorStandPlace" |
  "AddChest" |
  "Throw" |
  "Attack" |
  "AttackNoDamage" |
  "AttackStrong" |
  "Warn" |
  "Shear" |
  "Milk" |
  "Thunder" |
  "Explode" |
  "Fire" |
  "Ignite" |
  "Fuse" |
  "Stare" |
  "Spawn" |
  "Shoot" |
  "BreakBlock" |
  "Launch" |
  "Blast" |
  "LargeBlast" |
  "Twinkle" |
  "Remedy" |
  "Infect" |
  "LevelUp" |
  "BowHit" |
  "BulletHit" |
  "ExtinguishFire" |
  "ItemFizz" |
  "ChestOpen" |
  "ChestClosed" |
  "ShulkerBoxOpen" |
  "ShulkerBoxClosed" |
  "EnderChestOpen" |
  "EnderChestClosed" |
  "PowerOn" |
  "PowerOff" |
  "Attach" |
  "Detach" |
  "Deny" |
  "Tripod" |
  "Pop" |
  "DropSlot" |
  "Note" |
  "Thorns" |
  "PistonIn" |
  "PistonOut" |
  "Portal" |
  "Water" |
  "LavaPop" |
  "Lava" |
  "Burp" |
  "BucketFillWater" |
  "BucketFillLava" |
  "BucketEmptyWater" |
  "BucketEmptyLava" |
  "ArmorEquipChain" |
  "ArmorEquipDiamond" |
  "ArmorEquipGeneric" |
  "ArmorEquipGold" |
  "ArmorEquipIron" |
  "ArmorEquipLeather" |
  "ArmorEquipElytra" |
  "Record13" |
  "RecordCat" |
  "RecordBlocks" |
  "RecordChirp" |
  "RecordFar" |
  "RecordMall" |
  "RecordMellohi" |
  "RecordStal" |
  "RecordStrad" |
  "RecordWard" |
  "Record11" |
  "RecordWait" |
  "unknown1" |
  "Flop" |
  "ElderGuardianCurse" |
  "MobWarning" |
  "MobWarningBaby" |
  "Teleport" |
  "ShulkerOpen" |
  "ShulkerClose" |
  "Haggle" |
  "HaggleYes" |
  "HaggleNo" |
  "HaggleIdle" |
  "ChorusGrow" |
  "ChorusDeath" |
  "Glass" |
  "PotionBrewed" |
  "CastSpell" |
  "PrepareAttack" |
  "PrepareSummon" |
  "PrepareWololo" |
  "Fang" |
  "Charge" |
  "CameraTakePicture" |
  "LeashKnotPlace" |
  "LeashKnotBreak" |
  "Growl" |
  "Whine" |
  "Pant" |
  "Purr" |
  "Purreow" |
  "DeathMinVolume" |
  "DeathMidVolume" |
  "unknown2" |
  "ImitateCaveSpider" |
  "ImitateCreeper" |
  "ImitateElderGuardian" |
  "ImitateEnderDragon" |
  "ImitateEnderman" |
  "unknown3" |
  "ImitateEvocationIllager" |
  "ImitateGhast" |
  "ImitateHusk" |
  "ImitateIllusionIllager" |
  "ImitateMagmaCube" |
  "ImitatePolarBear" |
  "ImitateShulker" |
  "ImitateSilverfish" |
  "ImitateSkeleton" |
  "ImitateSlime" |
  "ImitateSpider" |
  "ImitateStray" |
  "ImitateVex" |
  "ImitateVindicationIllager" |
  "ImitateWitch" |
  "ImitateWither" |
  "ImitateWitherSkeleton" |
  "ImitateWolf" |
  "ImitateZombie" |
  "ImitateZombiePigman" |
  "ImitateZombieVillager" |
  "BlockEndPortalFrameFill" |
  "BlockEndPortalSpawn" |
  "RandomAnvilUse" |
  "BottleDragonBreath" |
  "PortalTravel" |
  "ItemTridentHit" |
  "ItemTridentReturn" |
  "ItemTridentRiptide1" |
  "ItemTridentRiptide2" |
  "ItemTridentRiptide3" |
  "ItemTridentThrow" |
  "ItemTridentThunder" |
  "ItemTridentHitGround" |
  "Default" |
  "BlockFletchingTableUse" |
  "ElemConstructOpen" |
  "IceBombHit" |
  "BalloonPop" |
  "LtReactionIceBomb" |
  "LtReactionBleach" |
  "LtReactionEPaste" |
  "LtReactionEPaste2" |
  "LtReactionFertilizer" |
  "LtReactionFireball" |
  "LtReactionMgsalt" |
  "LtReactionMiscfire" |
  "LtReactionFire" |
  "LtReactionMiscexplosion" |
  "LtReactionMiscmystical" |
  "LtReactionMiscmystical2" |
  "LtReactionProduct" |
  "SparklerUse" |
  "GlowstickUse" |
  "SparklerActive" |
  "ConvertToDrowned" |
  "BucketFillFish" |
  "BucketEmptyFish" |
  "BubbleUp" |
  "BubbleDown" |
  "BubblePop" |
  "BubbleUpInside" |
  "BubbleDownInside" |
  "HurtBaby" |
  "DeathBaby" |
  "StepBaby" |
  "BabySpawn" |
  "Born" |
  "BlockTurtleEggBreak" |
  "BlockTurtleEggCrack" |
  "BlockTurtleEggHatch" |
  "TurtleLayEgg" |
  "BlockTurtleEggAttack" |
  "BeaconActivate" |
  "BeaconAmbient" |
  "BeaconDeactivate" |
  "BeaconPower" |
  "ConduitActivate" |
  "ConduitAmbient" |
  "ConduitAttack" |
  "ConduitDeactivate" |
  "ConduitShort" |
  "Swoop" |
  "BlockBambooSaplingPlace" |
  "PreSneeze" |
  "Sneeze" |
  "AmbientTame" |
  "Scared" |
  "BlockScaffoldingClimb" |
  "CrossbowLoadingStart" |
  "CrossbowLoadingMiddle" |
  "CrossbowLoadingEnd" |
  "CrossbowShoot" |
  "CrossbowQuickChargeStart" |
  "CrossbowQuickChargeMiddle" |
  "CrossbowQuickChargeEnd" |
  "AmbientAggressive" |
  "AmbientWorried" |
  "CantBreed" |
  "ItemShieldBlock" |
  "ItemBookPut" |
  "BlockGrindstoneUse" |
  "BlockBellHit" |
  "BlockCampfireCrackle" |
  "Roar" |
  "Stun" |
  "BlockSweetBerryBushHurt" |
  "BlockSweetBerryBushPick" |
  "UICartographyTableTakeResult" |
  "UIStoneCutterTakeResult" |
  "BlockComposterEmpty" |
  "BlockComposterFill" |
  "BlockComposterFillSuccess" |
  "BlockComposterReady" |
  "BlockBarrelOpen" |
  "BlockBarrelClose" |
  "RaidHorn" |
  "BlockLoomUse" |
  "AmbientRaid" |
  "UICartographyTableUse" |
  "UIStoneCutterUse" |
  "UILoomUse" |
  "SmokerUse" |
  "BlastFurnaceUse" |
  "SmithingTableUse" |
  "Screech" |
  "Sleep" |
  "FurnaceUse" |
  "MooshroomConvert" |
  "MilkSuspiciously" |
  "Celebrate" |
  "JumpPrevent" |
  "AmbientPollinate" |
  "BeeHiveDrip" |
  "BeeHiveEnter" |
  "BeeHiveExit" |
  "BeeHiveWork" |
  "BeeHiveShear" |
  "HoneyBottleDrink" |
  "AmbientCave" |
  "Retreat" |
  "ConvertToZombified" |
  "Admire" |
  "StepLava" |
  "Tempt" |
  "Panic" |
  "Angry" |
  "AmbientWarpedForest" |
  "AmbientSoulsandValley" |
  "AmbientNetherWastes" |
  "AmbientBasaltDeltas" |
  "AmbientCrimsonForest" |
  "RespawnAnchorCharge" |
  "RespawnAnchorDeplete" |
  "RespawnAnchorSetSpawn" |
  "RespawnAnchorAmbient" |
  "SoulEscapeQuiet" |
  "SoulEscapeLoud" |
  "RecordPigstep" |
  "LinkCompassToLodestone" |
  "BlockSmithingTableUse" |
  "EquipNetherite" |
  "AmbientLoopWarpedForest" |
  "AmbientLoopSoulsandValley" |
  "AmbientLoopNetherWastes" |
  "AmbientLoopBasaltDeltas" |
  "AmbientLoopCrimsonForest" |
  "AmbientAdditionWarpedForest" |
  "AmbientAdditionSoulsandValley" |
  "AmbientAdditionNetherWastes" |
  "AmbientAdditionBasaltDeltas" |
  "AmbientAdditionCrimsonForest" |
  "SculkSensorPowerOn" |
  "SculkSensorPowerOff" |
  "BucketFillPowderSnow" |
  "BucketEmptyPowderSnow" |
  "PointedDripstoneCauldronDripWater" |
  "PointedDripstoneCauldronDripLava" |
  "PointedDripstoneDripWater" |
  "PointedDripstoneDripLava" |
  "CaveVinesPickBerries" |
  "BigDripleafTiltDown" |
  "BigDripleafTiltUp" |
  "unknown335" |
  "unknown336" |
  "unknown337" |
  "unknown338" |
  "copper_wax_on" |
  "copper_wax_off" |
  "scrape" |
  "player_hurt_drown" |
  "player_hurt_on_fire" |
  "player_hurt_freeze" |
  "use_spyglass" |
  "stop_using_spyglass" |
  "amethyst_block_chime" |
  "ambient_screamer" |
  "hurt_screamer" |
  "death_screamer" |
  "milk_screamer" |
  "jump_to_block" |
  "pre_ram" |
  "pre_ram_screamer" |
  "ram_impact" |
  "ram_impact_screamer" |
  "squid_ink_squirt" |
  "glow_squid_ink_squirt" |
  "convert_to_stray" |
  "extinguish_candle" |
  "ambient_candle" |
  "Undefined" 
)
export type LegacyEntityType = (
  "chicken" |
   "cow" |
   "pig" |
   "sheep" |
   "wolf" |
   "villager" |
   "mooshroom" |
   "squid" |
   "rabbit" |
   "bat" |
   "iron_golem" |
   "snow_golem" |
   "ocelot" |
   "horse" |
   "donkey" |
   "mule" |
   "skeleton_horse" |
   "zombie_horse" |
   "polar_bear" |
   "llama" |
   "parrot" |
   "dolphin" |
   "zombie" |
   "creeper" |
   "skeleton" |
   "spider" |
   "zombie_pigman" |
   "slime" |
   "enderman" |
   "silverfish" |
   "cave_spider" |
   "ghast" |
   "magma_cube" |
   "blaze" |
   "zombie_villager" |
   "witch" |
   "stray" |
   "husk" |
   "wither_skeleton" |
   "guardian" |
   "elder_guardian" |
   "npc" |
   "wither" |
   "ender_dragon" |
   "shulker" |
   "endermite" |
   "agent" |
   "vindicator" |
   "phantom" |
   "armor_stand" |
   "tripod_camera" |
   "player" |
   "item" |
   "tnt" |
   "falling_block" |
   "moving_block" |
   "xp_bottle" |
   "xp_orb" |
   "eye_of_ender_signal" |
   "ender_crystal" |
   "fireworks_rocket" |
   "thrown_trident" |
   "turtle" |
   "cat" |
   "shulker_bullet" |
   "fishing_hook" |
   "chalkboard" |
   "dragon_fireball" |
   "arrow" |
   "snowball" |
   "egg" |
   "painting" |
   "minecart" |
   "fireball" |
   "splash_potion" |
   "ender_pearl" |
   "leash_knot" |
   "wither_skull" |
   "boat" |
   "wither_skull_dangerous" |
   "lightning_bolt" |
   "small_fireball" |
   "area_effect_cloud" |
   "hopper_minecart" |
   "tnt_minecart" |
   "chest_minecart" |
   "command_block_minecart" |
   "lingering_potion" |
   "llama_spit" |
   "evocation_fang" |
   "evocation_illager" |
   "vex" |
   "ice_bomb" |
   "balloon" |
   "pufferfish" |
   "salmon" |
   "drowned" |
   "tropicalfish" |
   "cod" |
   "panda" 
)
export interface LoginTokens {
  identity: LittleString
  client: LittleString
}
export type PlayStatusTypes = (
  "login_success" |
  "failed_client" |
  "failed_spawn" |
  "player_spawn" |
  "failed_invalid_tenant" |
  "failed_vanilla_edu" |
  "failed_edu_vanilla" |
  "failed_server_full"
)
export type ResourcePackClientResponseStatus = (
  "none" |
  "refused" |
  "send_packs" |
  "have_all_packs" |
  "completed"
)
export type TextType = (
  "raw" |
  "chat" |
  "translation" |
  "popup" |
  "jukebox_popup" |
  "tip" |
  "system" |
  "whisper" |
  "announcement" |
  "json_whisper" |
  "json" 
)
export type StartGameMovementAuth = (
  "client" |
  "server" |
  "server_with_rewind"
)
export type MovePlayerMode = (
  "normal" |
  "reset" |
  "teleport" |
  "rotation"
)
export type MovePlayerTeleportCause = (
  "unknown" |
  "projectile" |
  "chorus_fruit" |
  "command" |
  "behavior"
)
export interface MovePlayerTeleport {
  cause: MovePlayerTeleportCause
  source_entity_type: LegacyEntityType
}
export type UpdateBlockFlags = (
  "neighbors" |
  "network" |
  "no_graphic" |
  "unused" |
  "priority"
)
export type LevelEventEvent = (
  "sound_click" |
  "sound_click_fail" |
  "sound_shoot" |
  "sound_door" |
  "sound_fizz" |
  "sound_ignite" |
  "sound_ghast" |
  "sound_ghast_shoot" |
  "sound_blaze_shoot" |
  "sound_door_bump" |
  "sound_door_crash" |
  "sound_enderman_teleport" |
  "sound_anvil_break" |
  "sound_anvil_use" |
  "sound_anvil_fall" |
  "sound_pop" |
  "sound_portal" |
  "sound_itemframe_add_item" |
  "sound_itemframe_remove" |
  "sound_itemframe_place" |
  "sound_itemframe_remove_item" |
  "sound_itemframe_rotate_item" |
  "sound_camera" |
  "sound_orb" |
  "sound_totem" |
  "sound_armor_stand_break" |
  "sound_armor_stand_hit" |
  "sound_armor_stand_fall" |
  "sound_armor_stand_place" |
  "pointed_dripstone_land" |
  "dye_used" |
  "ink_sack_used" |
  "particle_shoot" |
  "particle_destroy" |
  "particle_splash" |
  "particle_eye_despawn" |
  "particle_spawn" |
  "particle_crop_growth" |
  "particle_guardian_curse" |
  "particle_death_smoke" |
  "particle_block_force_field" |
  "particle_projectile_hit" |
  "particle_dragon_egg_teleport" |
  "particle_crop_eaten" |
  "particle_critical" |
  "particle_enderman_teleport" |
  "particle_punch_block" |
  "particle_bubble" |
  "particle_evaporate" |
  "particle_destroy_armor_stand" |
  "particle_breaking_egg" |
  "particle_destroy_egg" |
  "particle_evaporate_water" |
  "particle_destroy_block_no_sound" |
  "particle_knockback_roar" |
  "particle_teleport_trail" |
  "particle_point_cloud" |
  "particle_explosion" |
  "particle_block_explosion" |
  "particle_vibration_signal" |
  "particle_dripstone_drip" |
  "particle_fizz_effect" |
  "particle_wax_on" |
  "particle_wax_off" |
  "particle_scrape" |
  "particle_electric_spark" |
  "start_rain" |
  "start_thunder" |
  "stop_rain" |
  "stop_thunder" |
  "pause_game" |
  "pause_game_no_screen" |
  "set_game_speed" |
  "redstone_trigger" |
  "cauldron_explode" |
  "cauldron_dye_armor" |
  "cauldron_clean_armor" |
  "cauldron_fill_potion" |
  "cauldron_take_potion" |
  "cauldron_fill_water" |
  "cauldron_take_water" |
  "cauldron_add_dye" |
  "cauldron_clean_banner" |
  "block_start_break" |
  "block_stop_break" |
  "set_data" |
  "players_sleeping" |
  "add_particle_mask" |
  "particle_bubble" |
  "particle_bubble_manual" |
  "particle_critical" |
  "particle_block_force_field" |
  "particle_smoke" |
  "particle_explode" |
  "particle_evaporation" |
  "particle_flame" |
  "particle_candle_flame" |
  "particle_lava" |
  "particle_large_smoke" |
  "particle_redstone" |
  "particle_rising_red_dust" |
  "particle_item_break" |
  "particle_snowball_poof" |
  "particle_huge_explode" |
  "particle_huge_explode_seed" |
  "particle_mob_flame" |
  "particle_heart" |
  "particle_terrain" |
  "particle_town_aura" |
  "particle_portal" |
  "particle_water_splash" |
  "particle_water_splash_manual" |
  "particle_water_wake" |
  "particle_drip_water" |
  "particle_drip_lava" |
  "particle_drip_honey" |
  "particle_stalactite_drip_water" |
  "particle_stalactite_drip_lava" |
  "particle_falling_dust" |
  "particle_mob_spell" |
  "particle_mob_spell_ambient" |
  "particle_mob_spell_instantaneous" |
  "particle_ink" |
  "particle_slime" |
  "particle_rain_splash" |
  "particle_villager_angry" |
  "particle_villager_happy" |
  "particle_enchantment_table" |
  "particle_tracking_emitter" |
  "particle_note" |
  "particle_witch_spell" |
  "particle_carrot" |
  "particle_mob_appearance" |
  "particle_end_rod" |
  "particle_dragons_breath" |
  "particle_spit" |
  "particle_totem" |
  "particle_food" |
  "particle_fireworks_starter" |
  "particle_fireworks_spark" |
  "particle_fireworks_overlay" |
  "particle_balloon_gas" |
  "particle_colored_flame" |
  "particle_sparkler" |
  "particle_conduit" |
  "particle_bubble_column_up" |
  "particle_bubble_column_down" |
  "particle_sneeze" |
  "particle_shulker_bullet" |
  "particle_bleach" |
  "particle_dragon_destroy_block" |
  "particle_mycelium_dust" |
  "particle_falling_red_dust" |
  "particle_campfire_smoke" |
  "particle_tall_campfire_smoke" |
  "particle_dragon_breath_fire" |
  "particle_dragon_breath_trail" |
  "particle_blue_flame" |
  "particle_soul" |
  "particle_obsidian_tear" |
  "particle_portal_reverse" |
  "particle_snowflake" |
  "particle_vibration_signal" |
  "particle_sculk_sensor_redstone" |
  "particle_spore_blossom_shower" |
  "particle_spore_blossom_ambient" |
  "particle_wax" |
  "particle_electric_spark" 
)
export type BlockEventType = (
  "sound" |
  "change_state"
)
export type EntityEventEventId = (
  "jump" |
  "hurt_animation" |
  "death_animation" |
  "arm_swing" |
  "stop_attack" |
  "tame_fail" |
  "tame_success" |
  "shake_wet" |
  "use_item" |
  "eat_grass_animation" |
  "fish_hook_bubble" |
  "fish_hook_position" |
  "fish_hook_hook" |
  "fish_hook_tease" |
  "squid_ink_cloud" |
  "zombie_villager_cure" |
  "respawn" |
  "iron_golem_offer_flower" |
  "iron_golem_withdraw_flower" |
  "love_particles" |
  "villager_angry" |
  "villager_happy" |
  "witch_spell_particles" |
  "firework_particles" |
  "in_love_particles" |
  "silverfish_spawn_animation" |
  "guardian_attack" |
  "witch_drink_potion" |
  "witch_throw_potion" |
  "minecart_tnt_prime_fuse" |
  "creeper_prime_fuse" |
  "air_supply_expired" |
  "player_add_xp_levels" |
  "elder_guardian_curse" |
  "agent_arm_swing" |
  "ender_dragon_death" |
  "dust_particles" |
  "arrow_shake" |
  "eating_item" |
  "baby_animal_feed" |
  "death_smoke_cloud" |
  "complete_trade" |
  "remove_leash" |
  "consume_totem" |
  "player_check_treasure_hunter_achievement" |
  "entity_spawn" |
  "dragon_puke" |
  "item_entity_merge" |
  "start_swim" |
  "balloon_pop" |
  "treasure_hunt" |
  "agent_summon" |
  "charged_crossbow" |
  "fall" 
)
export type InteractActionId = (
  "leave_vehicle" |
  "mouse_over_entity" |
  "open_inventory"
)
export type SetSpawnPositionType = (
  "player" |
  "world"
)
export type AnimateActionId = (
  "none" |
  "swing_arm" |
  "unknown" |
  "wake_up" |
  "critical_hit" |
  "magic_critical_hit" |
  "row_right" |
  "row_left"
)
export type CraftingEventRecipeType = (
  "inventory" |
  "crafting" |
  "workbench"
)
export type AdventureFlags = (
  "world_immutable" |
  "no_pvp" |
  "auto_jump" |
  "allow_flight" |
  "no_clip" |
  "world_builder" |
  "flying" |
  "muted"
)
export type AdventureCommandPermission = (
  "normal" |
  "operator" |
  "host" |
  "automation" |
  "admin"
)
export type ActionPermissions = (
  "mine" |
  "doors_and_switches" |
  "open_containers" |
  "attack_players" |
  "attack_mobs" |
  "operator" |
  "teleport" |
  "build" |
  "default"
)
export type AdventurePermission = (
  "visitor" |
  "member" |
  "operator" |
  "custom"
)
export type EventType = (
  "achievement_awarded" |
  "entity_interact" |
  "portal_built" |
  "portal_used" |
  "mob_killed" |
  "cauldron_used" |
  "player_death" |
  "boss_killed" |
  "agent_command" |
  "agent_created" |
  "banner_pattern_removed" |
  "commaned_executed" |
  "fish_bucketed" |
  "mob_born" |
  "pet_died" |
  "cauldron_block_used" |
  "composter_block_used" |
  "bell_block_used" |
  "actor_definition" |
  "raid_update" |
  "player_movement_anomaly" |
  "player_moement_corrected" |
  "honey_harvested" |
  "target_block_hit" |
  "piglin_barter" |
  "waxed_or_unwaxed_copper"
)
export type UpdateMapFlags = (
  "void" |
  "texture" |
  "decoration" |
  "initialisation"
)
export interface ClientBoundMapItemDataTracked {
  objects: TrackedObject[]
  decorations: MapDecoration[]
}
export interface ClientBoundMapItemDataTexture{
  width: zigzag32
  height: zigzag32
  x_offset: zigzag32
  y_offset: zigzag32
  pixels: varint[]
}
export type BossEventType = (
  "show_bar" |
  "register_player" |
  "hide_bar" |
  "unregister_player" |
  "set_bar_progress" |
  "set_bar_title" |
  "update_properties" |
  "texture"
)
export interface AvailableCommandsEnum {
  name: string
  values: u8[] | lu16[] | lu32[]
}
export interface AvailableCommandsData {
  name: string
  description: string
  flags: lu16
  permission_level: u8
  alias: li32
  overloads: AvailableCommandsDataOverload[]
}
export interface AvailableCommandsDataOverload {
  paramater_name: string
  value_type: AvailableCommandsDataOverloadValueType
  enum_type: AvailableCommandsDataOverloadEnumType
  optional: bool
  options: CommandFlags[]
}
export type CommandFlags = (
  "unused" |
  "has_semantic_constraint" |
  "collapse_enum"
)
export type AvailableCommandsDataOverloadEnumType = (
  "valid" |
  "enum" |
  "suffixed" |
  "soft_enum" 
)
export type AvailableCommandsDataOverloadValueType = (
  "int" |
  "float" |
  "value" |
  "wildcard_int" |
  "operator" |
  "target" |
  "file_path" |
  "string" |
  "position" |
  "message" |
  "raw_text" |
  "json" |
  "command"
)
export interface DynamicEnum {
  name: string
  values: string[]
}
export interface EnumConstraint {
  value_index: li32
  enum_index: li32
  constraints: Constraint[]
}
export type Constraints = (
  "cheats_enabled" |
  "operator_permissions" |
  "host_permissions"
)
export interface Constraint {
  constraint: Constraints
}
export type CommandBlockUpdateMode = (
  "impulse" |
  "repeat" |
  "chain"
)
export type CommandOutputType = (
  "last" |
  "silent" |
  "all" |
  "data_set"
)
export interface CommandOutputOutput {
  success: bool
  message_id: string
  paramaters: string[]
}
export type ResourcePackDataType = (
  "addon" |
  "cached" |
  "copy_protected" |
  "behavior" |
  "persona_piece" |
  "resources" |
  "skins" |
  "world_template"
)
export type SetTitleType = (
  "clear" |
  "reset" |
  "set_title" |
  "set_subtitle" |
  "action_bar_message" |
  "set_durations" |
  "set_title_json" |
  "set_subtitle_json" |
  "action_bar_message_json"
)
export type BookEditType = (
  "replace_page" |
  "add_page" |
  "delete_page" |
  "swap_pages" |
  "sign"
)
export type NPCRequestType = (
  "set_actions" |
  "execute_action" |
  "execute_closing_commands" |
  "set_name" |
  "set_skin" |
  "set_interaction_text" 
)
export type NPCRequestActionType = (
  "set_actions" |
  "execute_action" |
  "execute_closing_commands" |
  "set_name" |
  "set_skin" |
  "set_interaction_text" |
  "execute_openining_commands"
)
export type SetScoreAction = (
  "change" |
  "remove"
)
export interface ScoreEntry {
  scoreboard_id: zigzag64
  objective_name: string
  score: li32
  entry_type?: ScoreEntryType
  entity_unique_id?: zigzag64
  custom_name?: string
}
export type ScoreEntryType = (
  "player" |
  "entity" |
  "fake_player"
)
export type LabTableAction = (
  "combine" |
  "react"
)
export type UpdateBlockSyncType = (
  "entity" |
  "create" |
  "destroy"
)
export type DeltaMoveFlags = (
  "has_x" |
  "has_y" |
  "has_z" |
  "has_rot_x" |
  "has_rot_y" |
  "has_rot_z" |
  "on_ground" |
  "teleport" |
  "force_move" 
)
export type ScoreboardIdentityAction = (
  "register_identity" |
  "clear_identity"
)
export interface ScoreboardIdentityEntry {
  scoreboard_id: zigzag64
  entity_unique_id?: zigzag64
}
export type StructureTemplateData = (
  "export_from_save" |
  "export_from_load" |
  "query_saved_structure"
)
export type StructureTemplateType = (
  "export" |
  "query"
)
export type MultiplayerSettingsType = (
  "enable_multiplayer" |
  "disable_multiplayer" |
  "refresh_join_code"
)
export type CompletedUsingItemMethod = (
  "equip_armor" |
  "eat" |
  "attack" |
  "consume" |
  "throw" |
  "shoot" |
  "place" |
  "fill_bottle" |
  "fill_bucket" |
  "pour_bucket" |
  "use_tool" |
  "interact" |
  "retrieved" |
  "dyed" |
  "traded" 
)
export type InputFlag = (
  "ascend" |
  "descend" |
  "north_jump" |
  "jump_down" |
  "sprint_down" |
  "change_height" |
  "jumping" |
  "auto_jumping_in_water" |
  "sneaking" |
  "sneak_down" |
  "up" |
  "down" |
  "left" |
  "right" |
  "up_left" |
  "up_right" |
  "want_up" |
  "want_down" |
  "want_down_slow" |
  "want_up_slow" |
  "sprinting" |
  "ascend_block" |
  "descend_block" |
  "sneak_toggle_down" |
  "persist_sneak" |
  "start_sprinting" |
  "stop_sprinting" |
  "start_sneaking" |
  "stop_sneaking" |
  "start_swimming" |
  "stop_swimming" |
  "start_jumping" |
  "start_gliding" |
  "stop_gliding" |
  "item_interact" |
  "block_action" |
  "item_stack_request"
)
export type PlayerAuthInputMode = (
  "unknown" |
  "mouse" |
  "touch" |
  "game_pad" |
  "motion_controller"
)
export type PlayerAuthInputPlayMode = (
  "normal" |
  "teaser" |
  "screen" |
  "viewer" |
  "reality" |
  "placement" |
  "living_room" |
  "exit_level" |
  "exit_level_living_room" |
  "num_modes" 
)
export interface PlayerAuthInputTransaction {
  legacy: TransactionLegacy
  actions: TransactionActions
  data: TransactionUseItem
}
export interface PlayerAuthInputBlockAction {
  action: Action
  position?: BlockCoordinates
  face?: zigzag32
}
export interface CreativeContentItem {
  entry_id: varint
  item: ItemLegacy
}
export type ArmorDamageType = (
  "head" |
  "chest" |
  "legs" |
  "feet"
)
export type PositionTrackingAction = (
  "update" |
  "destroy" |
  "not_found"
)
export type PacketViolationSeverity = (
  "warning" |
  "final_warning" |
  "terminating"
)
export type CameraShakeAction = (
  "add" |
  "stop"
)
export type DebugRendererType = (
  "clear" |
  "add_cube"
)
export type SimulationTypeType = (
  "game" |
  "editor" |
  "test" |
  "invalid"
)
export type NPCDialogueType = (
  "open" |
  "close"
)
