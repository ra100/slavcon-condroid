import { Agent, interceptors, request, setGlobalDispatcher } from 'undici'
import {
  FieldData,
  GuestResponse,
  LineResponse,
  RoomResponse,
  ScheduleNode,
  ScheduleResponse,
  YearResponse
} from './responseTypes'

const baseUrl = 'https://slavcon.sk'

const { cache, dns, retry } = interceptors

const defaultDispatcher = new Agent({
  connections: 100, // Limit concurrent kept-alive connections to not run out of resources
  headersTimeout: 10_000, // 10 seconds; set as appropriate for the remote servers you plan to connect to
  bodyTimeout: 10_000
}).compose(cache(), dns(), retry())

setGlobalDispatcher(defaultDispatcher)

export interface RawGuest {
  uid: number
  name: string
}

export interface RawRoom {
  tid: number
  name: string
  description: string
  weight: number
}

export interface RawLine {
  tid: number
  name: string
  color: string
}

export enum SlavconProgramType {
  COMPETITION = 7,
  DISCUSSION = 25,
  GAME = 23,
  OTHER = 26,
  PERFORMANCE = 16,
  TALK = 5,
  WORKSHOP = 6
}

export interface RawProgram {
  pid: number
  authors: number[]
  title: string
  type: SlavconProgramType[]
  programLines: number[]
  location: number
  startTime: string
  endTime: string
  annotation: string
  highlight: boolean
  changed: string
  summary: string
}

export const loadAuthors = async (year: number): Promise<RawGuest[]> => {
  const { body, statusCode } = await request(`${baseUrl}/sk/jsonapi/views/users/guests_page?views-argument[0]=${year}`)

  if (statusCode !== 200) {
    throw new Error(`Failed to fetch authors: ${statusCode}`)
  }

  const data = (await body.json()) as unknown as GuestResponse

  return data.data.map(({ attributes }) => ({
    uid: attributes.drupal_internal__uid,
    name: attributes.field_displayname ?? attributes.field_meno
  }))
}

export const loadYearTid = async (year: number): Promise<number> => {
  const { body, statusCode } = await request(`${baseUrl}/sk/jsonapi/taxonomy_term/rocnik?filter[name]=${year}`)

  if (statusCode !== 200) {
    throw new Error(`Failed to fetch year: ${statusCode}`)
  }

  const data = (await body.json()) as unknown as YearResponse

  return data.data[0].attributes.drupal_internal__tid
}

export const loadRooms = async (yearTid: number): Promise<RawRoom[]> => {
  const { body, statusCode } = await request(
    `${baseUrl}/sk/jsonapi/taxonomy_term/miestnosti?filter[field_rocnik.meta.drupal_internal__target_id]=${yearTid}`
  )

  if (statusCode !== 200) {
    throw new Error(`Failed to fetch rooms: ${statusCode}`)
  }

  const data = (await body.json()) as unknown as RoomResponse

  return data.data.map(({ attributes }) => ({
    tid: attributes.drupal_internal__tid,
    name: attributes.name,
    description: attributes.description?.processed || '',
    weight: attributes.weight
  }))
}

export const loadLines = async (yearTid: number): Promise<RawLine[]> => {
  const { body, statusCode } = await request(
    `${baseUrl}/sk/jsonapi/taxonomy_term/anotacie?filter[field_rocnik.meta.drupal_internal__target_id]=${yearTid}`
  )

  if (statusCode !== 200) {
    throw new Error(`Failed to fetch lines: ${statusCode}`)
  }

  const data = (await body.json()) as unknown as LineResponse

  return data.data.map(({ attributes }) => ({
    tid: attributes.drupal_internal__tid,
    name: attributes.name,
    color: attributes.field_color?.color
  }))
}

const getEndTime = (startTime: string, length: number) =>
  new Date(new Date(startTime).getTime() + length * 60_000).toISOString()

const getInternalIds = (data: FieldData) => data.meta.drupal_internal__target_id

const mapToRawProgram = ({ attributes, relationships }: ScheduleNode): RawProgram => ({
  pid: attributes.drupal_internal__nid,
  title: attributes.title,
  startTime: attributes.field_start ? new Date(attributes.field_start).toISOString() : '',
  endTime: attributes.field_start ? getEndTime(attributes.field_start, attributes.field_dlzka) : '',
  annotation: attributes.body.processed,
  authors: relationships.field_guest.data?.map(getInternalIds),
  type: relationships.field_type.data?.map(getInternalIds) ?? [],
  programLines: relationships.field_category.data?.map(getInternalIds),
  location: relationships.field_miestnost.data?.meta.drupal_internal__target_id,
  highlight: attributes.field_highlight,
  changed: new Date(attributes.changed).toISOString(),
  summary:
    attributes.body.summary !== ''
      ? attributes.body.summary
      : attributes.metatag.find(({ attributes }) => attributes.name === 'description')?.attributes.content ??
        attributes.body.processed
})

export const loadSchedule = async (year: number): Promise<RawProgram[]> => {
  const { body, statusCode } = await request(
    `${baseUrl}/sk/jsonapi/views/program/program_page?views-argument[0]=${year}`
  )

  if (statusCode !== 200) {
    throw new Error(`Failed to fetch programs: ${statusCode}`)
  }

  const data = (await body.json()) as unknown as ScheduleResponse

  return data.data.map(mapToRawProgram).filter(({ startTime }) => Boolean(startTime))
}

export const loadScheduleExtra = async (year: number): Promise<RawProgram[]> => {
  const { body, statusCode } = await request(
    `${baseUrl}/sk/jsonapi/views/program/extra_program?views-argument[0]=${year}`
  )

  if (statusCode !== 200) {
    throw new Error(`Failed to fetch extra programs: ${statusCode}`)
  }

  const data = (await body.json()) as unknown as ScheduleResponse

  return data.data.map(mapToRawProgram)
}
