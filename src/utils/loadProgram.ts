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

const { cache, dns, retry } = interceptors

const baseUrl = 'https://slavcon.sk'

const defaultDispatcher = new Agent({
  connections: 100, // Limit concurrent kept-alive connections to not run out of resources
  connectTimeout: 30_000, // Increase connect timeout to 30 seconds
  headersTimeout: 30_000, // Increase headers timeout to 30 seconds
  bodyTimeout: 30_000 // Increase body timeout to 30 seconds
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
  weight: number
  extraProgram: boolean
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

const loggedRequest = async <T>(url: string): Promise<T> => {
  const startTime = Date.now()
  console.log(`[${new Date(startTime).toISOString()}] Requesting URL: ${url}`)
  let statusCode = 0
  try {
    const response = await request(url, { dispatcher: defaultDispatcher })
    statusCode = response.statusCode
    const duration = Date.now() - startTime
    console.log(
      `[${new Date().toISOString()}] Request finished for URL: ${url} | Status: ${statusCode} | Duration: ${duration}ms`
    )

    if (statusCode !== 200) {
      // Attempt to read body for error details, but don't fail if it's not JSON
      let errorBody = ''
      try {
        errorBody = await response.body.text()
      } catch (bodyError) {
        console.error(`[${new Date().toISOString()}] Failed to read error body for URL: ${url}`, bodyError)
      }
      throw new Error(`Request failed for ${url} with status ${statusCode}. Body: ${errorBody}`)
    }

    const data = (await response.body.json()) as T
    return data
  } catch (error) {
    const duration = Date.now() - startTime
    // Log the error with duration, differentiating between network errors and non-200 status codes
    if (statusCode === 0) {
      // Likely a network/connection error before getting a status
      console.error(`[${new Date().toISOString()}] Request failed for URL: ${url} | Duration: ${duration}ms`, error)
    } else {
      // Error was thrown due to non-200 status after logging success
      console.error(
        `[${new Date().toISOString()}] Error processing response for URL: ${url} | Status: ${statusCode} | Duration: ${duration}ms`,
        error
      )
    }
    // Re-throw the original error to be handled by the caller
    throw error
  }
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

export const loadLines = async (yearTid: number): Promise<RawLine[]> => {
  const fields = 'drupal_internal__tid,name,field_color,weight,field_extra_program'
  const url = `${baseUrl}/sk/jsonapi/taxonomy_term/anotacie?filter[field_rocnik.meta.drupal_internal__target_id]=${yearTid}&fields[taxonomy_term--anotacie]=${fields}`

  const data = await loggedRequest<LineResponse>(url)

  return data.data.map(({ attributes }) => ({
    tid: attributes.drupal_internal__tid,
    name: attributes.name,
    color: attributes.field_color?.color,
    weight: attributes.weight,
    extraProgram: attributes.field_extra_program
  }))
}

export const loadAuthors = async (year: number): Promise<RawGuest[]> => {
  const fields = 'drupal_internal__uid,field_displayname,field_meno'
  const url = `${baseUrl}/sk/jsonapi/views/users/guests_page?views-argument[0]=${year}&fields[user--user]=${fields}`

  const data = await loggedRequest<GuestResponse>(url)

  return data.data.map(({ attributes }) => ({
    uid: attributes.drupal_internal__uid,
    name: attributes.field_displayname ?? attributes.field_meno
  }))
}

export const loadYearTid = async (year: number): Promise<number> => {
  const fields = 'drupal_internal__tid'
  const url = `${baseUrl}/sk/jsonapi/taxonomy_term/rocnik?filter[name]=${year}&fields[taxonomy_term--rocnik]=${fields}`

  const data = await loggedRequest<YearResponse>(url)

  if (!data.data || data.data.length === 0) {
    throw new Error(`Year ${year} not found.`)
  }

  return data.data[0].attributes.drupal_internal__tid
}

export const loadRooms = async (yearTid: number): Promise<RawRoom[]> => {
  const fields = 'drupal_internal__tid,name,description,weight'
  const url = `${baseUrl}/sk/jsonapi/taxonomy_term/miestnosti?filter[field_rocnik.meta.drupal_internal__target_id]=${yearTid}&fields[taxonomy_term--miestnosti]=${fields}`

  const data = await loggedRequest<RoomResponse>(url)

  return data.data.map(({ attributes }) => ({
    tid: attributes.drupal_internal__tid,
    name: attributes.name,
    description: attributes.description?.processed || '',
    weight: attributes.weight
  }))
}

const scheduleFields =
  'drupal_internal__nid,title,field_start,field_dlzka,body,field_highlight,changed,metatag,field_guest,field_type,field_category,field_miestnost'

export const loadSchedule = async (year: number): Promise<RawProgram[]> => {
  const url = `${baseUrl}/sk/jsonapi/views/program/program_page?views-argument[0]=${year}&fields[node--program]=${scheduleFields}`

  const data = await loggedRequest<ScheduleResponse>(url)

  return data.data.map(mapToRawProgram).filter(({ startTime }) => Boolean(startTime))
}

export const loadScheduleExtra = async (year: number): Promise<RawProgram[]> => {
  const url = `${baseUrl}/sk/jsonapi/views/program/extra_program?views-argument[0]=${year}&fields[node--program]=${scheduleFields}`

  const data = await loggedRequest<ScheduleResponse>(url)

  return data.data.map(mapToRawProgram)
}
