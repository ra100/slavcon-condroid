import { fetch } from 'undici'
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

interface RawProgram {
  pid: number
  authors: number[]
  title: string
  type: ProgramType
  programLines: number[]
  location: number
  startTime: string
  endTime: string
  annotation: string
}

interface RawGuest {
  uid: number
  name: string
}

interface RawRoom {
  tid: number
  name: string
}

interface RawLine {
  tid: number
  name: string
}

/**
 *  B - beseda, diskuzní pořad
    C - ceremoniál, divadlo
    D - dokument, bonusový materiál
    F - film, seriál (promítání)
    G - herní turnaj
    H - koncert, diskotéka
    P - přednáška
    Q - soutěž
    W - workshop
 */
enum ProgramType {
  DISCUSSION = 'B',
  PERFORMANCE = 'C',
  DOCUMENT = 'D',
  FILM = 'F',
  COMPETITION = 'G',
  CONCERT = 'H',
  TALK = 'P',
  QUIZ = 'Q',
  WORKSHOP = 'W'
}

enum SlavconProgramType {
  TALK = 5,
  DISCUSSION = 25,
  WORKSHOP = 6,
  GAME = 23,
  PERFORMANCE = 16,
  COMPETITION = 7,
  OTHER = 26
}

interface Program {
  pid: number
  author: string
  title: string
  type: ProgramType
  programLine: string
  location: string
  startTime: string
  endTime: string
  annotation: string
}

const mapProgramType = (programTypeTid: number) =>
  ({
    [SlavconProgramType.TALK]: ProgramType.TALK,
    [SlavconProgramType.DISCUSSION]: ProgramType.DISCUSSION,
    [SlavconProgramType.WORKSHOP]: ProgramType.WORKSHOP,
    [SlavconProgramType.GAME]: ProgramType.QUIZ,
    [SlavconProgramType.PERFORMANCE]: ProgramType.PERFORMANCE,
    [SlavconProgramType.COMPETITION]: ProgramType.COMPETITION,
    [SlavconProgramType.OTHER]: ProgramType.TALK
  }[programTypeTid] || ProgramType.TALK)

const getEndTime = (startTime: string, length: number) =>
  new Date(new Date(startTime).getTime() + length * 60_000).toISOString()

const getInternalIds = (data: FieldData) => data.meta.drupal_internal__target_id

const loadSchedule = async (year: number): Promise<RawProgram[]> => {
  const response = await fetch(`${baseUrl}/sk/jsonapi/views/program/program_page?views-argument[0]=${year}`)
  const data = (await response.json()) as unknown as ScheduleResponse

  return data.data
    .map(({ attributes, relationships }: ScheduleNode) => ({
      pid: attributes.drupal_internal__nid,
      title: attributes.title,
      startTime: attributes.field_start,
      endTime: getEndTime(attributes.field_start, attributes.field_dlzka),
      annotation: attributes.body.processed,
      authors: relationships.field_guest.data?.map(getInternalIds),
      type: relationships.field_type.data?.map(getInternalIds).map(mapProgramType).at(0) ?? ProgramType.TALK,
      programLines: relationships.field_category.data?.map(getInternalIds),
      location: relationships.field_miestnost.data?.meta.drupal_internal__target_id
    }))
    .filter(({ startTime }) => Boolean(startTime))
}

const loadAuthors = async (year: number): Promise<RawGuest[]> => {
  const response = await fetch(`${baseUrl}/sk/jsonapi/views/users/guests_page?views-argument[0]=${year}`)
  const data = (await response.json()) as unknown as GuestResponse

  return data.data.map(({ attributes }) => ({
    uid: attributes.drupal_internal__uid,
    name: attributes.field_displayname ?? attributes.field_meno
  }))
}

const loadYearTid = async (year: number): Promise<number> => {
  const response = await fetch(`${baseUrl}/sk/jsonapi/taxonomy_term/rocnik?filter[name]=${year}`)
  const data = (await response.json()) as unknown as YearResponse

  return data.data[0].attributes.drupal_internal__tid
}

const loadRooms = async (yearTid: number): Promise<RawRoom[]> => {
  const response = await fetch(
    `${baseUrl}/sk/jsonapi/taxonomy_term/miestnosti?filter[field_rocnik.meta.drupal_internal__target_id]=${yearTid}`
  )
  const data = (await response.json()) as unknown as RoomResponse
  console.error(data)

  return data.data.map(({ attributes }) => ({
    tid: attributes.drupal_internal__tid,
    name: attributes.name
  }))
}

const loadLines = async (yearTid: number): Promise<RawLine[]> => {
  const response = await fetch(
    `${baseUrl}/sk/jsonapi/taxonomy_term/anotacie?filter[field_rocnik.meta.drupal_internal__target_id]=${yearTid}`
  )
  console.error(response)
  const data = (await response.json()) as unknown as LineResponse

  return data.data.map(({ attributes }) => ({
    tid: attributes.drupal_internal__tid,
    name: attributes.name
  }))
}

const mapScheduleToProgram =
  (authors: Map<RawGuest['uid'], RawGuest>, rooms: Map<RawRoom['tid'], RawRoom>, lines: Map<RawLine['tid'], RawLine>) =>
  (data: RawProgram): Program => ({
    pid: data.pid,
    title: data.title,
    type: data.type,
    programLine: data.programLines.map((line) => lines.get(line)?.name).at(0) || 'UNDEFINED',
    location: rooms.get(data.location)?.name || 'UNDEFINED',
    startTime: data.startTime,
    endTime: data.endTime,
    annotation: data.annotation,
    author: data.authors?.map((author: number) => authors.get(author)?.name).join(', ') || 'UNDEFINED'
  })

const convertToXML = (program: Program[]) => {
  return `<annotations>
  ${program
    .map((p) => {
      return `  <programme>
    <pid>${p.pid}</pid>
    <author><![CDATA[${p.author}]]></author>
    <title><![CDATA[${p.title}]]></title>
    <type>${p.type}</type>
    <program-line>${p.programLine}</program-line>
    <location>${p.location}</location>
    <start-time>${p.startTime}</start-time>
    <end-time>${p.endTime}</end-time>
    <annotation><![CDATA[${p.annotation}]]></annotation>
  </programme>`
    })
    .join('\n')}
</annotations>`
}

/**
 * <annotations> - kořenový element, může být v dokumentu maximálně jednou.
 *   <programme> - element obalující jednotlivé pořady
 *     <pid> - ID programu. Musí být unikátní v rámci akce a pro jeden pořad zůstat stejné i po změně souboru (kvůli rozpoznání změn). Povinné.
 *     <author> - Autor, Jméno, nick, cokoliv. Povinné. Obsah musí být obalený v <![CDATA[ ]]>
 *     <title> - Název pořadu. Povinné. Obsah musí být obalený v <![CDATA[ ]]>
 *     <type> - Typ pořadu. Viz níže. Povinné.
 *     <program-line> - Název programové linie. Povinné. Obsah musí být obalený v <![CDATA[ ]]>
 *     <location> - Umístění pořadu (místnost). Pokud se akce konná ve více budovách nebo chcete zjednodušit navigaci, zadávejte od nejobecnějšího k konkrétnímu (např. KD Junior, Velký sál nebo 1. patro, místnost 20). Nepovinné.
 *     <start-time> - Začátek pořadu. Nepovinné. (pokud je vyplněn, je ale nutné vyplnit i end-time)
 *     <end-time> - Konec pořadu. Nepovinné. (pokud je vyplněn, je ale nutné vyplnit i start-time)
 *     <annotation> - Anotace. Nepovinné, pokud ale nebude uvedená, nezobrazí se detail pořadu. Obsah musí být obalený v <![CDATA[ ]]>
 *
 * @param year
 * @returns xml
 */
export const getCondroidFormat = async (year: number) => {
  const [schedule, authors, yearTid] = await Promise.all([loadSchedule(year), loadAuthors(year), loadYearTid(year)])
  console.debug(schedule, authors, yearTid)
  const [rooms, lines] = await Promise.all([loadRooms(yearTid), loadLines(yearTid)])
  const authorsMap = authors.reduce((acc, cur) => {
    acc.set(cur.uid, cur)
    return acc
  }, new Map<RawGuest['uid'], RawGuest>())
  const roomsMap = rooms.reduce((acc, cur) => {
    acc.set(cur.tid, cur)
    return acc
  }, new Map<RawRoom['tid'], RawRoom>())
  const linesMap = lines.reduce((acc, cur) => {
    acc.set(cur.tid, cur)
    return acc
  }, new Map<RawLine['tid'], RawLine>())

  const mappedProgram = schedule.map(mapScheduleToProgram(authorsMap, roomsMap, linesMap))

  return convertToXML(mappedProgram)
}
