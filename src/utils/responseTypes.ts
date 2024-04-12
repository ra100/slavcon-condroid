export interface MainResponse<DataType = []> {
  jsonapi: Jsonapi
  data: DataType[]
  meta: MainMeta
  links: NodeLinks
}

export type ScheduleResponse = MainResponse<ScheduleNode>
export type GuestResponse = MainResponse<GuestData>
export type YearResponse = MainResponse<YearData>
export type RoomResponse = MainResponse<RoomData>
export type LineResponse = MainResponse<LineData>

export interface ScheduleNode {
  type: 'node--program'
  id: string
  links: NodeLinks
  attributes: ScheduleAttributes
  relationships: ScheduleRelationships
}

type DateString = string

export interface ScheduleAttributes {
  drupal_internal__nid: number
  drupal_internal__vid: number
  langcode: Langcode
  revision_timestamp: DateString
  revision_log: null
  status: boolean
  title: string
  created: DateString
  changed: DateString
  promote: boolean
  sticky: boolean
  default_langcode: boolean
  revision_translation_affected: boolean
  moderation_state: ModerationState
  path: Path
  content_translation_source: ContentTranslationSource | null
  content_translation_outDateStringd: boolean
  body: Body
  field_dlzka: number
  field_highlight: boolean
  field_metatag: FieldMetatag | null
  field_note: null | string
  field_obsah: null | string
  field_presentations_options: string[]
  field_prezentacia_url: string[]
  field_shorttitle: null | string
  field_split: null
  field_start: DateString
  field_tech: null | string
  metatag: { attributes: { content: string; name: string }; tag: string }[]
}

export interface Body {
  value: string
  format: Format
  processed: string
  summary: string
}

export enum Format {
  BasicHTML = 'basic_html',
  RestrictedHTML = 'restricted_html'
}

export enum ContentTranslationSource {
  Und = 'und'
}

export interface FieldMetatag {
  robots: string
}

export enum Langcode {
  En = 'en',
  Sk = 'sk'
}

export enum ModerationState {
  Published = 'published'
}

export interface Path {
  alias: string
  pid: number
  langcode: Langcode
}

export interface NodeLinks {
  self: Self
}

export interface Self {
  href: string
}

export interface ScheduleRelationships {
  node_type: FieldSingle
  revision_uid: FieldSingle
  uid: FieldSingle
  field_category: FieldMultiple
  field_guest: FieldMultiple
  field_miestnost: FieldSingle
  field_picture: FieldOptional
  field_prezentacia_file: FieldMultiple
  field_rocnik: FieldMultiple
  field_type: FieldMultiple
}

interface FieldSingle {
  data: FieldData
  links: FieldLinks
}

interface FieldOptional {
  data: FieldData
  links: FieldLinks
}

interface FieldMultiple {
  data: FieldData[]
  links: FieldLinks
}

export interface ScheduleNodeMeta {
  drupal_internal__target_id: number
}

export interface FieldData {
  type: string
  id: string
  meta: FieldMeta
}

export interface FieldMeta {
  drupal_internal__target_id: number
}

export interface FieldLinks {
  related: Self
  self: Self
}

export interface Jsonapi {
  version: string
  meta: JsonapiMeta
}

export interface JsonapiMeta {
  links: NodeLinks
}

export interface MainMeta {
  count: number
}

export interface GuestData {
  type: 'user--user'
  id: string
  links: NodeLinks
  attributes: GuestAttributes
}

export interface GuestAttributes {
  display_name: string
  drupal_internal__uid: number
  langcode: string
  name: string
  created: Date
  changed: Date
  default_langcode: boolean
  metatag: null
  path: Path
  content_translation_source: string
  content_translation_outdated: boolean
  content_translation_status: boolean
  content_translation_created: Date | null
  field_bio: FieldFullText | null
  field_displayname: string
  field_funkcia: null | string
  field_guest_category: any[]
  field_info: string
  field_meno: string
  field_metatag: FieldMetatag | null
  field_nick: null | string
  field_priority: number
  field_profesia: null | string
  field_typ_hosta: string
}

interface FieldFullText {
  value: string
  format: string
  processed: string
}

interface YearData {
  type: 'taxonomy_term--rocnik'
  id: string
  links: NodeLinks
  attributes: YearAttributes
}

interface YearAttributes {
  drupal_internal__tid: number
  name: string
}

interface RoomData {
  type: 'taxonomy_term--miestnosti'
  id: string
  links: NodeLinks
  attributes: RoomAttributes
}

interface RoomAttributes {
  drupal_internal__tid: number
  name: string
  description: FieldFullText
  weight: number
}

interface LineData {
  type: 'taxonomy_term--anotacie'
  id: string
  links: NodeLinks
  attributes: LineAttributes
}

interface LineAttributes {
  drupal_internal__tid: number
  name: string
  field_color: {
    color: string
    opacity: number | null
  }
}
