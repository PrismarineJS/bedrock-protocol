/* eslint-disable @typescript-eslint/no-empty-interface */
export * from './packetTypes'
import {
  bool,
  i32,
  LoginTokens,
  PlayStatusTypes,
  TexturePackInfos,
  BehaviorPackInfos,
  ResourcePackIdVersions,
  Experiments,
  ResourcePackClientResponseStatus,
  ResourcePackIds,
  TextType,
  zigzag32,
  zigzag64,
  varint64,
  GameMode,
  vec3f,
  vec2f,
  li16,
  BlockCoordinates,
  lf32,
  varint,
  GameRules,
  li32,
  StartGameMovementAuth,
  li64,
  BlockProperties,
  Itemstates,
  uuid,
  MetadataDictionary,
  Links,
  Item,
  EntityAttributes,
  u8,
  Rotation,
  MovePlayerMode,
  MovePlayerTeleport,
  UpdateBlockFlags,
  LevelEventEvent,
  BlockEventType,
  EntityEventEventId,
  PlayerAttributes,
  Transaction,
  WindowID,
  InteractActionId,
  lu64,
  Action,
  Link,
  SetSpawnPositionType,
  AnimateActionId,
  WindowType,
  WindowIDVarint,
  ItemStacks,
  Recipes,
  PotionTypeRecipes,
  PotionContainerChangeRecipes,
  CraftingEventRecipeType,
  AdventureFlags,
  AdventureCommandPermission,
  ActionPermissions,
  AdventurePermission,
  nbt,
  ByteArray,
  PlayerRecords,
  EventType,
  UpdateMapFlags,
  ClientBoundMapItemDataTracked,
  ClientBoundMapItemDataTexture,
  BossEventType,
  AvailableCommandsEnum,
  AvailableCommandsData,
  DynamicEnum,
  EnumConstraint,
  CommandOrigin,
  CommandBlockUpdateMode,
  CommandOutputType,
  CommandOutputOutput,
  lu32,
  ResourcePackDataType,
  lu16,
  SetTitleType,
  StructureBlockSettings,
  Skin,
  BookEditType,
  NPCRequestType,
  NPCRequestActionType,
  SetScoreAction,
  ScoreEntry,
  LabTableAction,
  vec3u,
  UpdateBlockSyncType,
  DeltaMoveFlags,
  ScoreboardIdentityAction,
  ScoreboardIdentityEntry,
  SoundType,
  nbtLoop,
  vec3i,
  StructureTemplateData,
  StructureTemplateType,
  MultiplayerSettingsType,
  CompletedUsingItemMethod,
  u16,
  InputFlag,
  PlayerAuthInputMode,
  PlayerAuthInputTransaction,
  ItemStackRequest,
  PlayerAuthInputBlockAction,
  CreativeContentItem,
  EnchantOption,
  ItemStackResponses,
  ArmorDamageType,
  PositionTrackingAction,
  PacketViolationSeverity,
  CameraShakeAction,
  ItemComponentList,
  DebugRendererType,
  SimulationTypeType,
  NPCDialogueType,
} from "./packetTypes"

/**
 * !id: 0x01
 * !bound: server
 */
export interface packet_login {
  protocol_version: i32
  tokens: LoginTokens
}
/**
 * !id: 0x02
 * !bound: client
 */
export interface packet_play_status {
  status: PlayStatusTypes
}
/**
 * !id: 0x03
 * !bound: client
 */
export interface packet_server_to_client_handshake {
  token: string
}
/**
 * !id: 0x04
 * !bound: client
 */
export interface packet_client_to_server_handshake {}
/**
 * !id: 0x05
 * !bound: client
 */
export interface packet_disconnect {
  hide_disconnect_reason: bool
  message: string
}
/**
 * !id: 0x06
 * !bound: client
 */
export interface packet_resource_packs_info {
  must_accept: bool
  has_scripts: bool
  force_server_packs: bool
  behaviour_packs: BehaviorPackInfos
  texture_packs: TexturePackInfos
}
/**
 * !id: 0x07
 * !bound: client
 */
export interface packet_resource_pack_stack {
  must_accept: bool
  behavior_packs: ResourcePackIdVersions
  resource_packs: ResourcePackIdVersions
  game_version: string
  experiments: Experiments
  experiments_previously_used: bool
}
/**
 * !id: 0x08
 * !bound: server
 */
export interface packet_resource_pack_client_response {
  response_status: ResourcePackClientResponseStatus
  resourcepackids: ResourcePackIds
}
/**
 * !id: 0x09
 * !bound: both
 */
export interface packet_text {
  type: TextType
  needs_translation: bool
  message: string
  xuid: string
  platform_chat_id: string
  source_name?: string
  paramaters?: string[]
}
/**
 * !id: 0x0a
 * !bound: client
 */
export interface packet_set_time {
  time: zigzag32
}
/**
 * !id: 0x0b
 * !bound: client
 */
export interface packet_start_game {
  entity_id: zigzag64
  runtime_entity_id: varint64
  player_gamemode: GameMode
  player_position: vec3f
  rotation: vec2f
  seed: zigzag32
  biome_type: li16
  biome_name: string
  dimension: zigzag32
  generator: zigzag32
  world_gamemode: GameMode
  difficulty: zigzag32
  spawn_position: BlockCoordinates
  achievements_disabled: bool
  day_cycle_stop_time: zigzag32
  edu_offer: zigzag32
  edu_features_enabled: bool
  edu_product_uuid: string
  rain_level: lf32
  lightning_level: lf32
  has_confirmed_platform_locked_content: bool
  is_multiplayer: bool
  broadcast_to_lan: bool
  xbox_live_broadcast_mode: varint
  platform_broadcast_mode: varint
  enable_commands: bool
  is_texturepacks_required: bool
  gamerules: GameRules
  experiments: Experiments
  experiments_previously_used: bool
  bonus_chest: bool
  map_enabled: bool
  permission_level: zigzag32
  server_chunk_tick_range: li32
  has_locked_behavior_pack: bool
  has_locked_resource_pack: bool
  is_from_locked_world_template: bool
  msa_gamertags_only: bool
  is_from_world_template: bool
  is_world_template_option_locked: bool
  only_spawn_v1_villagers: bool
  game_version: string
  limited_world_width: li32
  limited_world_length: li32
  is_new_nether: bool
  experimental_gameplay_override: bool
  level_id: string
  world_name: string
  premium_world_template_id: string
  is_trial: bool
  movement_authority: StartGameMovementAuth
  rewind_history_size: zigzag32
  server_authoritative_block_breaking: bool
  current_tick: li64
  enchantment_seed: zigzag32
  block_properties: BlockProperties
  itemstates: Itemstates
  multiplayer_correlation_id: string
  server_authoritative_inventory: bool
  engine: string
}
/**
 * !id: 0x0c
 * !bound: client
 */
export interface packet_add_player {
  uuid: uuid
  username: string
  entity_id_self: zigzag64
  runtime_entity_id: varint64
  platform_chat_id: string
   position: vec3f
   velocity: vec3f
   pitch: lf32
   yaw: lf32
   head_yaw: lf32
   held_item: Item
   metadata: MetadataDictionary
   flags: varint
   command_permission: varint
   action_permissions: varint
   permission_level: varint
   custom_stored_permissions: varint
   user_id: li64
   links: Links
   device_id: string
   device_os: li32
}
/**
 * !id: 0x0d
 * !bound: client
 */
export interface packet_add_entity {
  entity_id_self: zigzag64
  runtime_entity_id: varint64
  entity_type: string
  position: vec3f
  velocity: vec3f
  pitch: lf32
  yaw: lf32
  head_yaw: lf32
  attributes: EntityAttributes
  metadata: MetadataDictionary
  links: Links
}
/**
 * !id: 0x0e
 * !bound: client
 */
export interface packet_remove_entity {
  entity_id_self: zigzag64
}
/**
 * !id: 0x0f
 * !bound: client
 */
export interface packet_add_item_entity {
  entity_id_self: zigzag64
  runtime_entity_id: varint64
  item: Item
  position: vec3f
  velocity: vec3f
  metadata: MetadataDictionary
  is_from_fishing: bool
}
/**
 * !id: 0x11
 * !bound: client
 */
export interface packet_take_item_entity {
  runtime_entity_id: varint64
   target: varint
}
/**
 * !id: 0x12
 * !bound: both
 */
export interface packet_move_entity {
  runtime_entity_id: varint64
  flags: u8
  position: vec3f
  rotation: Rotation
}
/**
 * !id: 0x13
 * !bound: both
 */
export interface packet_move_player {
  runtime_id: varint
  position: vec3f
  pitch: lf32
  yaw: lf32
  head_yaw: lf32
  mode: MovePlayerMode
  on_ground: bool
  ridden_runtime_id: varint
  teleport?: MovePlayerTeleport
  tick: varint64
}
/**
 * !id: 0x14
 * !bound: both
 */
export interface packet_rider_jump {
  jump_strength: zigzag32
}
/**
 * !id: 0x15
 * !bound: client
 */
export interface packet_update_block {
  position: BlockCoordinates
  block_runtime_id: varint
  flags: UpdateBlockFlags[]
  layer: varint
}
/**
 * !id: 0x16
 * !bound: client
 */
export interface packet_add_painting {
  entity_id_self: zigzag64
  runtime_entity_id: varint64
  coordinates: vec3f
  direction: zigzag32
  title: string
}
/**
 * !id: 0x17
 * !bound: both
 */
export interface packet_tick_sync {
  request_time: li64
  response_time: li64
}
/**
 * !id: 0x18
 * !bound: both
 */
export interface packet_level_sound_event_old {
  sound_id: u8
  position: vec3f
  block_id: zigzag32
  entity_type: zigzag32
  is_baby_mob: bool
  is_global: bool
}
/**
 * !id: 0x19
 * !bound: client
 */
export interface packet_level_event {
  event: LevelEventEvent
  position: vec3f
  data: zigzag32
}
/**
 * !id: 0x1a
 * !bound: client
 */
export interface packet_block_event {
  position: BlockCoordinates
  type: BlockEventType
  data: zigzag32
}
/**
 * !id: 0x1b
 * !bound: both
 */
export interface packet_entity_event {
  runtime_entity_id: varint64
  event_id: EntityEventEventId
  data: zigzag32
}
/**
 * !id: 0x1c
 * !bound: client
 */
export interface packet_mob_effect {
  runtime_entity_id: varint64
  event_id: u8
  effect_id: zigzag32
  amplifier: zigzag32
  particles: bool
  duration: zigzag32
}
/**
 * !id: 0x1d
 * !bound: client
 */
export interface packet_update_attributes {
  runtime_entity_id: varint64
  attributes: PlayerAttributes
  tick: varint64
}
/**
 * !id: 0x1e
 * !bound: both
 */
export interface packet_inventory_transaction {
  transaction: Transaction
}
/**
 * !id: 0x1f
 * !bound: both
 */
export interface packet_mob_equipment {
  runtime_entity_id: varint64
  item: Item
  slot: u8
  selected_slot: u8
  window_id: WindowID
}
/**
 * !id: 0x20
 * !bound: both
 */
export interface packet_mob_armor_equipment {
  runtime_entity_id: varint64
  helmet: Item
  chestplate: Item
  leggings: Item
  boots: Item
}
/**
 * !id: 0x21
 * !bound: both
 */
export interface packet_interact {
  action_id: InteractActionId
  target_entity_id: varint64
  position?: vec3f
}
/**
 * !id: 0x22
 * !bound: server
 */
export interface packet_block_pick_request {
  x: zigzag32
  y: zigzag32
  z: zigzag32
  add_user_data: bool
  selected_slot: u8
}
/**
 * !id: 0x23
 * !bound: server
 */
export interface packet_entity_pick_request {
  runtime_entity_id: lu64
  selected_slot: u8
}
/**
 * !id: 0x24
 * !bound: server
 */
export interface packet_player_action {
  runtime_entity_id: varint64
  action: Action
  position: BlockCoordinates
  face: zigzag32
}
/**
 * !id: 0x26
 * !bound: client
 */
export interface packet_hurt_armor {
  health: zigzag32
}
/**
 * !id: 0x27
 * !bound: both
 */
export interface packet_set_entity_data {
  runtime_entity_id: varint64
  metadata: MetadataDictionary
  tick: varint
}
/**
 * !id: 0x28
 * !bound: both
 */
export interface packet_set_entity_motion {
  runtime_entity_id: varint64
  velocity: vec3f
}
/**
 * !id: 0x29
 * !bound: client
 */
export interface packet_set_entity_link {
  link: Link
}
/**
 * !id: 0x2a
 * !bound: client
 */
export interface packet_set_health {
  health: zigzag32
}
/**
 * !id: 0x2b
 * !bound: client
 */
export interface packet_set_spawn_position {
  spawn_type: SetSpawnPositionType
  player_position: BlockCoordinates
  dimension: zigzag32
  world_position: BlockCoordinates
}
/**
 * !id: 0x2c
 * !bound: both
 */
export interface packet_animate {
  action_id: AnimateActionId
}
/**
 * !id: 0x2d
 * !bound: both
 */
export interface packet_respawn {
  position: vec3f
  state: u8
  runtime_entity_id: varint64
}
/**
 * !id: 0x2e
 * !bound: client
 */
export interface packet_container_open {
  window_id: WindowID
  window_type: WindowType
  coordinates: BlockCoordinates
  runtime_entity_id: zigzag64
}
/**
 * !id: 0x2f
 * !bound: both
 */
export interface packet_container_close {
  window_id: WindowID
  server: bool
}
/**
 * !id: 0x30
 * !bound: both
 */
export interface packet_player_hotbar {
  selected_slot: varint
  window_id: WindowID
  select_slot: bool
}
/**
 * !id: 0x31
 * !bound: both
 */
export interface packet_inventory_content {
  window_id: WindowIDVarint
  input: ItemStacks
}
/**
 * !id: 0x32
 * !bound: both
 */
export interface packet_inventory_slot {
  window_id: WindowIDVarint
  slot: varint
  item: Item
}
/**
 * !id: 0x33
 * !bound: client
 */
export interface packet_container_set_data {
  window_id: WindowID
  property: zigzag32
  value: zigzag32
}
/**
 * !id: 0x34
 * !bound: client
 */
export interface packet_crafting_data {
  recipes: Recipes
  potion_type_recipes: PotionTypeRecipes
  potion_container_recipes: PotionContainerChangeRecipes
  is_clean: bool
}
/**
 * !id: 0x35
 * !bound: both
 */
export interface packet_crafting_event {
  window_id: WindowID
  recipe_type:CraftingEventRecipeType
  recipe_id: uuid
  input: Item[]
  result: Item[]
}
/**
 * !id: 0x36
 * !bound: client
 */
export interface packet_gui_data_pick_item {
  item_name: string
  item_effects: string
  hotbar_slot: li32
}
/**
 * !id: 0x37
 * !bound: both
 */
export interface packet_adventure_settings {
  flags: AdventureFlags
  command_permission: AdventureCommandPermission
  action_permissions: ActionPermissions
  permission_level: AdventurePermission
  custom_stored_permissions: varint
  user_id: li64
}
/**
 * !id: 0x38
 * !bound: both
 */
export interface packet_block_entity_data {
  position: BlockCoordinates
  nbt: nbt
}
/**
 * !id: 0x39
 * !bound: server
 */
export interface packet_player_input {
  motion_x: lf32
  motion_z: lf32
  jumping: bool
  sneaking: bool
}
/**
 * !id: 0x3a
 * !bound: client
 */
export interface packet_level_chunk {
  x: zigzag32
  z: zigzag32
  sub_chunk_count: varint
  cache_enabled: bool
  blobs?: lu64[]
  payload: ByteArray
}
/**
 * !id: 0x3b
 * !bound: client
 */
export interface packet_set_commands_enabled {
  enabled: bool
}
/**
 * !id: 0x3c
 * !bound: client
 */
export interface packet_set_difficulty {
  difficulty: varint
}
/**
 * !id: 0x3d
 * !bound: client
 */
export interface packet_change_dimension {
  dimension: zigzag32
  position: vec3f
  respawn: bool
}
/**
 * !id: 0x3e
 * !bound: both
 */
export interface packet_set_player_game_type {
  gamemode: GameMode
}
/**
 * !id: 0x3f
 * !bound: client
 */
export interface packet_player_list {
  records: PlayerRecords
}
/**
 * !id: 0x40
 * !bound: client
 */
export interface packet_simple_event {
  records: PlayerRecords
}
/**
 * !id: 0x41
 * !bound: client
 */
export interface packet_event {
  runtime_id: varint64
  event_type: EventType
  use_player_id: u8
  event_data: unknown
}
/**
 * !id: 0x42
 * !bound: client
 */
export interface packet_spawn_experience_orb {
  position: vec3f
  count: zigzag32
}
/**
 * !id: 0x43
 * !bound: client
 */
export interface packet_clientbound_map_item_data {
  map_id: zigzag64
  update_flags: UpdateMapFlags
  dimension: u8
  locked: bool
  included_in?: zigzag64[]
  scale?: u8
  tracked?: ClientBoundMapItemDataTracked
  texture?: ClientBoundMapItemDataTexture
}
/**
 * !id: 0x44
 * !bound: both
 */
export interface packet_map_info_request {
  map_id: zigzag64
}
/**
 * !id: 0x45
 * !bound: both
 */
export interface packet_request_chunk_radius {
  chunk_radius: zigzag32
}
/**
 * !id: 0x46
 * !bound: client
 */
export interface packet_chunk_radius_update {
  chunk_radius: zigzag32
}
/**
 * !id: 0x47
 * !bound: both
 */
export interface packet_item_frame_drop_item {
  coordinates: BlockCoordinates
}
/**
 * !id: 0x48
 * !bound: client
 */
export interface packet_game_rules_changed {
  rules: GameRules
}
/**
 * !id: 0x49
 * !bound: client
 */
export interface packet_camera {
  camera_entity_unique_id: zigzag64
  target_player_unique_id: zigzag64
}
/**
 * !id: 0x4a
 * !bound: both
 */
export interface packet_boss_event {
  boss_entity_id: zigzag64
  type: BossEventType
  title?: string
  progress?: lf32
  screen_darkening?: li16
  color?: varint
  overlay?: varint
  player_id?: zigzag64
}
/**
 * !id: 0x4b
 * !bound: client
 */
export interface packet_show_credits {
  runtime_entity_id: varint64
  status: zigzag32
}
/**
 * !id: 0x4c
 * !bound: client
 */
export interface packet_available_commands {
  values_len: varint
  _enum_type: string
  enum_values: string[]
  suffixes: string[]
  enums: AvailableCommandsEnum[]
  command_data: AvailableCommandsData[]
  dynamic_enums: DynamicEnum[]
  enum_constraints: EnumConstraint[]
}
/**
 * !id: 0x4d
 * !bound: server
 */
export interface packet_command_request {
  command: string
  origin: CommandOrigin
  interval: bool
}
/**
 * !id: 0x4e
 * !bound: server
 */
export interface packet_command_block_update {
  is_block: bool
  minecart_entity_runtime_id?: varint64
  position?: BlockCoordinates
  mode?: CommandBlockUpdateMode
  needs_redstone?: bool
  conditional?: bool
  command: string
  last_output: string
  name: string
  should_track_output: bool
  tick_delay: li32
  execute_on_first_tick: bool
}
/**
 * !id: 0x4f
 * !bound: client
 */
export interface packet_command_output {
  origin: CommandOrigin
  output_type: CommandOutputType
  success_count: varint
  output: CommandOutputOutput[]
  data_set?: string
}
/**
 * !id: 0x50
 * !bound: client
 */
export interface packet_update_trade {
  window_id: WindowID
  window_type: WindowType
  size: varint
  trade_tier: varint
  villager_unique_id: varint64
  entity_unique_id: varint64
  display_name: string
  new_trading_ui: bool
  economic_trades: bool
  offers: nbt
}
/**
 * !id: 0x51
 * !bound: client
 */
export interface packet_update_equipment {
  window_id: WindowID
  window_type: WindowType
  size: u8
  entity_id: zigzag64
  inventory: nbt
}
/**
 * !id: 0x52
 * !bound: client
 */
export interface packet_resource_pack_data_info {
  pack_id: string
  max_chunk_size: lu32
  chunk_count: lu32
  size: lu64
  hash: ByteArray
  is_premium: bool
  pack_type: ResourcePackDataType
}
/**
 * !id: 0x53
 * !bound: client
 */
export interface packet_resource_pack_chunk_data {
  pack_id: string
  chunk_index: lu32
  progress: lu64
  payload: ByteArray
}
/**
 * !id: 0x54
 * !bound: server
 */
export interface packet_resource_pack_chunk_request {
  pack_id: string
  chunk_index: lu32
}
/**
 * !id: 0x55
 * !bound: client
 */
export interface packet_transfer {
  server_address: string
  port: lu16
}
/**
 * !id: 0x56
 * !bound: client
 */
export interface packet_play_sound {
  name: string
  coordinates: BlockCoordinates
  volume: lf32
  pitch: lf32
}
/**
 * !id: 0x57
 * !bound: client
 */
export interface packet_stop_sound {
  name: string
  stop_all: bool
}
/**
 * !id: 0x58
 * !bound: client
 */
export interface packet_set_title {
  type: SetTitleType
  text: string
  fade_in_time: zigzag32
  stay_time: zigzag32
  fade_out_time: zigzag32
  xuid: string
  platform_online_id: string
}
/**
 * !id: 0x59
 * !bound: client
 */
export interface packet_add_behavior_tree {
  behaviortree: string
}
/**
 * !id: 0x5a
 * !bound: client
 */
export interface packet_structure_block_update {
  position: BlockCoordinates
  structure_name: string
  data_field: string
  include_players: bool
  show_bounding_box: bool
  structure_block_type: zigzag32
  settings: StructureBlockSettings
  redstone_save_mode: zigzag32
  should_trigger: bool
}
/**
 * !id: 0x5b
 * !bound: client
 */
export interface packet_show_store_offer {
  offer_id: string
  show_all: bool
}
/**
 * !id: 0x5c
 * !bound: server
 */
export interface packet_purchase_receipt {
  receipts: string[]
}
/**
 * !id: 0x5d
 * !bound: both
 */
export interface packet_player_skin {
  uuid: uuid
  skin: Skin
  skin_name: string
  old_skin_name: string
  is_verified: bool
}
/**
 * !id: 0x5e
 * !bound: client
 */
export interface packet_sub_client_login {
  tokens: LoginTokens
}
/**
 * !id: 0x5f
 * !bound: client
 */
export interface packet_initiate_web_socket_connection {
  server: string
}
/**
 * !id: 0x60
 * !bound: client
 */
export interface packet_set_last_hurt_by {
  entity_type: varint
}
/**
 * !id: 0x61
 * !bound: client
 */
export interface packet_book_edit {
  type: BookEditType
  slot: u8
  page_number?: u8
  text?: string
  photo_name?: string
  page1?: u8
  page2?: u8
  title?: string
  author?: string
  xuid?: string
}
/**
 * !id: 0x62
 * !bound: both
 */
export interface packet_npc_request {
  runtime_entity_id: varint64
  request_type: NPCRequestType
  command: string
  action_type: NPCRequestActionType
  scene_name: string
}
/**
 * !id: 0x63
 * !bound: server
 */
export interface packet_photo_transfer {
  image_name: string
  image_data: string
  book_id: string
}
/**
 * !id: 0x64
 * !bound: client
 */
export interface packet_modal_form_request {
  form_id: varint
  data: string
}
/**
 * !id: 0x65
 * !bound: server
 */
export interface packet_modal_form_response {
  form_id: varint
  data: string
}
/**
 * !id: 0x66
 * !bound: server
 */
export interface packet_server_settings_request {}
/**
 * !id: 0x67
 * !bound: client
 */
export interface packet_server_settings_response {
  form_id: varint
  data: string
}
/**
 * !id: 0x68
 * !bound: client
 */
export interface packet_show_profile {
  xuid: string
}
/**
 * !id: 0x69
 * !bound: client
 */
export interface packet_set_default_game_type {
  gamemode: GameMode
}
/**
 * !id: 0x6a
 * !bound: client
 */
export interface packet_remove_objective {
  objective_name: string
}
/**
 * !id: 0x6b
 * !bound: client
 */
export interface packet_set_display_objective {
  display_slot: string
  objective_name: string
  display_name: string
  criteria_name: string
  sort_order: zigzag32
}
/**
 * !id: 0x6c
 * !bound: client
 */
export interface packet_set_score {
  action: SetScoreAction
  entries: ScoreEntry[]
}
/**
 * !id: 0x6d
 * !bound: both
 */
export interface packet_lab_table {
  action_type: LabTableAction
  position: vec3u
  reaction_type: u8
}
/**
 * !id: 0x6e
 * !bound: client
 */
export interface packet_update_block_synced {
  position: BlockCoordinates
  block_runtime_id: varint
  flags: UpdateBlockFlags
  layer: varint
  entity_unique_id: zigzag64
  transition_type: UpdateBlockSyncType
}
/**
 * !id: 0x6f
 * !bound: client
 */
export interface packet_move_entity_delta {
  runtime_entity_id: varint64
  flags: DeltaMoveFlags
  x?: lf32
  y?: lf32
  z?: lf32
  rot_x?: u8
  rot_y?: u8
  rot_z?: u8
}
/**
 * !id: 0x70
 * !bound: client
 */
export interface packet_set_scoreboard_identity {
  action: ScoreboardIdentityAction
  entries: ScoreboardIdentityEntry[]
}
/**
 * !id: 0x71
 * !bound: server
 */
export interface packet_set_local_player_as_initialized {
  runtime_entity_id: varint64
}
/**
 * !id: 0x72
 * !bound: client
 */
export interface packet_update_soft_enum {}
/**
 * !id: 0x73
 * !bound: both
 */
export interface packet_network_stack_latency {
  timestamp: lu64
  needs_response: u8
}
/**
 * !id: 0x75
 * !bound: both
 */
export interface packet_script_custom_event {
  event_name: string
  event_data: string
}
/**
 * !id: 0x76
 * !bound: client
 */
export interface packet_spawn_particle_effect {
  dimension: u8
  entity_id: zigzag64
  position: vec3f
  particle_name: string
}
/**
 * !id: 0x77
 * !bound: client
 */
export interface packet_available_entity_identifiers {
  nbt: nbt
}
/**
 * !id: 0x78
 * !bound: both
 */
export interface packet_level_sound_event_v2 {
  sound_id: u8
  position: vec3f
  block_id: zigzag32
  entity_type: string
  is_baby_mob: bool
  is_global: bool
}
/**
 * !id: 0x79
 * !bound: client
 */
export interface packet_network_chunk_publisher_update {
  coordinates: BlockCoordinates
  radius: varint
}
/**
 * !id: 0x7a
 * !bound: client
 */
export interface packet_biome_definition_list {
  nbt: nbt
}
/**
 * !id: 0x7b
 * !bound: both
 */
export interface packet_level_sound_event {
  sound_id: SoundType
  position: vec3f
  extra_data: zigzag32
  entity_type: string
  is_baby_mob: bool
  is_global: bool
}
/**
 * !id: 0x7c
 * !bound: client
 */
export interface packet_level_event_generic {
  event_id: varint
  nbt: nbtLoop
}
/**
 * !id: 0x7d
 * !bound: client
 */
export interface packet_lectern_update {
  page: u8
  page_count: u8
  position: vec3i
  drop_book: bool
}
/**
 * !id: 0x7e
 * !bound: client
 */
export interface packet_video_stream_connect {
  server_uri: string
  frame_send_frequency: lf32
  action: u8
  resolution_x: li32
  resolution_y: li32
}
/**
 * !id: 0x7f
 * !bound: client
 */
export interface packet_add_ecs_entity {
  network_id: varint64
}
/**
 * !id: 0x80
 * !bound: client
 */
export interface packet_remove_ecs_entity {
  network_id: varint64
}
/**
 * !id: 0x81
 * !bound: both
 */
export interface packet_client_cache_status {
  network_id: varint64
  enabled: bool
}
/**
 * !id: 0x82
 * !bound: client
 */
export interface packet_on_screen_texture_animation {
  animation_type: lu32
}
/**
 * !id: 0x83
 * !bound: client
 */
export interface packet_map_create_locked_copy {
  original_map_id: zigzag64
  new_map_id: zigzag64
}
/**
 * !id: 0x84
 * !bound: client
 */
export interface packet_structure_template_data_export_request {
  name: string
  position: BlockCoordinates
  settings: StructureBlockSettings
  request_type: StructureTemplateData
}
/**
 * !id: 0x85
 * !bound: client
 */
export interface packet_structure_template_data_export_response {
  name: string
  success: bool
  nbt?: nbt
  response_type: StructureTemplateType
}
/**
 * !id: 0x86
 * !bound: client
 */
export interface packet_update_block_properties {
  nbt: nbt
}
/**
 * !id: 0x87
 * !bound: client
 */
export interface packet_client_cache_blob_status {
  misses: varint
  haves: varint
  missing: lu64[]
  have: lu64[]
}
/**
 * !id: 0x88
 * !bound: client
 */
export interface packet_client_cache_miss_response {
  blobs: Blob[]
}
/**
 * !id: 0x89
 * !bound: client
 */
export interface packet_education_settings {
  CodeBuilderDefaultURI: string
  CodeBuilderTitle: string
  CanResizeCodeBuilder: bool
  HasOverrideURI: bool
  OverrideURI?: string
  HasQuiz: bool
}
/**
 * !id: 0x8b
 * !bound: server
 */
export interface packet_multiplayer_settings {
  action_type: MultiplayerSettingsType
}
/**
 * !id: 0x8c
 * !bound: server
 */
export interface packet_settings_command {
  command_line: string
  suppress_output: bool
}
/**
 * !id: 0x8d
 * !bound: server
 */
export interface packet_anvil_damage {
  damage: u8
  position: BlockCoordinates
}
/**
 * !id: 0x8e
 * !bound: client
 */
export interface packet_completed_using_item {
  used_item_id: li16
  use_method: CompletedUsingItemMethod
}
/**
 * !id: 0x8f
 * !bound: both
 */
export interface packet_network_settings {
  compression_threshold: u16
}
/**
 * !id: 0x90
 * !bound: server
 */
export interface packet_player_auth_input {
  pitch: lf32
  yaw: lf32
  position: vec3f
  move_vector: vec2f
  head_yaw: lf32
  input_data: InputFlag
  input_mode: PlayerAuthInputMode
  play_mode: PlayerAuthInputMode
  gaze_direction?: vec3f
  tick: varint64
  delta: vec3f
  transaction?: PlayerAuthInputTransaction
  item_stack_request?: ItemStackRequest
  block_action?: PlayerAuthInputBlockAction
}
/**
 * !id: 0x91
 * !bound: client
 */
export interface packet_creative_content {
  items: CreativeContentItem[]
}
/**
 * !id: 0x92
 * !bound: client
 */
export interface packet_player_enchant_options {
  options: EnchantOption[]
}
/**
 * !id: 0x93
 * !bound: server
 */
export interface packet_item_stack_request {
  requests: ItemStackRequest[]
}
/**
 * !id: 0x94
 * !bound: client
 */
export interface packet_item_stack_response {
  responses: ItemStackResponses
}
/**
 * !id: 0x95
 * !bound: client
 */
export interface packet_player_armor_damage {
  responses: ItemStackResponses
  type: ArmorDamageType
  helmet_damage?: zigzag32
  chestplate_damage?: zigzag32
  leggings_damage?: zigzag32
  boots_damage?: zigzag32
}
/**
 * !id: 0x97
 * !bound: server
 */
export interface packet_update_player_game_type {
  gamemode: GameMode
  player_unique_id: zigzag64
}
/**
 * !id: 0x9a
 * !bound: server
 */
export interface packet_position_tracking_db_request {
  gamemode: GameMode
  player_unique_id: zigzag64
  action: 'query'
  tracking_id: zigzag32
}
/**
 * !id: 0x99
 * !bound: client
 */
export interface packet_position_tracking_db_broadcast {
  broadcast_action: PositionTrackingAction
  tracking_id: zigzag32
  nbt: nbt
}
/**
 * !id: 0x9c
 * !bound: server
 */
export interface packet_packet_violation_warning {
  violation_type: 'malformed'
  severity: PacketViolationSeverity
  packet_id: zigzag32
  reason: string
}
/**
 * !id: 0x9d
 * !bound: client
 */
export interface packet_motion_prediction_hints {
  entity_runtime_id: varint64
  velocity: vec3f
  on_ground: bool
}
/**
 * !id: 0x9e
 * !bound: client
 */
export interface packet_animate_entity {
  animation: string
  next_state: string
  stop_condition: string
  controller: string
  blend_out_time: lf32
  runtime_entity_ids: varint64[]
}
/**
 * !id: 0x9f
 * !bound: client
 */
export interface packet_camera_shake {
  intensity: lf32
  duration: lf32
  type: u8
  action: CameraShakeAction
}
/**
 * !id: 0xa0
 * !bound: client
 */
export interface packet_player_fog {
  stack: string[]
}
/**
 * !id: 0xa1
 * !bound: client
 */
export interface packet_correct_player_move_prediction {
  position: vec3f
  delta: vec3f
  on_ground: bool
  tick: varint64
}
/**
 * !id: 0xa2
 * !bound: client
 */
export interface packet_item_component {
  entries: ItemComponentList
}
/**
 * !id: 0xa3
 * !bound: client
 */
export interface packet_filter_text_packet {
  text: string
  from_server: bool
}
/**
 * !id: 0xa4
 * !bound: client
 */
export interface packet_debug_renderer {
  type: DebugRendererType
  text: string
  position?: vec3f
  red?: lf32
  green?: lf32
  blue?: lf32
  alpha?: lf32
  duration?: li64
}
/**
 * !id: 0xa5
 * !bound: client
 */
export interface packet_sync_entity_property {
  nbt: nbt
}
/**
 * !id: 0xa6
 * !bound: client
 */
export interface packet_add_volume_entity {
  entity_id: varint64
  nbt: nbt
}
/**
 * !id: 0xa7
 * !bound: client
 */
export interface packet_remove_volume_entity {
  entity_id: varint64
}
/**
 * !id: 0xa8
 * !bound: client
 */
export interface packet_simulation_type {
  type: SimulationTypeType
}
/**
 * !id: 0xa9
 * !bound: client
 */
export interface packet_npc_dialogue {
  entity_id: lu64
  action_type: NPCDialogueType
  dialogue: string
  screen_name: string
  npc_name: string
  action_json: string
}
