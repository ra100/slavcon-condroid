import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

import { feedbackForm, floorPlan, slavconData } from '../../slavconData'
import {
  loadAuthors,
  loadLines,
  loadRooms,
  loadSchedule,
  loadScheduleExtra,
  loadYearTid,
  RawGuest,
  RawLine,
  RawProgram,
  RawRoom,
  SlavconProgramType
} from '../../utils/loadProgram'

interface ConbotProgram {
  annotation: string
  color: string
  endTime: string
  highlight: boolean
  location: string
  pid: number
  programLine: string
  speaker?: string
  startTime: string
  summary: string
  title: string
  type: string
  weight: number
}

dayjs.extend(utc)
dayjs.extend(timezone)

const mapProgramTypeToText = (programType: SlavconProgramType[]): ConbotProgram['type'] =>
  programType
    .map(
      (tid) =>
        ({
          [SlavconProgramType.COMPETITION]: 'Súťaž',
          [SlavconProgramType.DISCUSSION]: 'Diskusia',
          [SlavconProgramType.GAME]: 'Hra',
          [SlavconProgramType.OTHER]: 'Iné',
          [SlavconProgramType.PERFORMANCE]: 'Vystúpenie',
          [SlavconProgramType.TALK]: 'Prednáška',
          [SlavconProgramType.WORKSHOP]: 'Workshop'
        }[tid])
    )
    .join(', ')

const rewriteTimezone = (time: string): string =>
  dayjs(time).tz('Europe/Bratislava').format('YYYY-MM-DDTHH:mm:ssZ').toString()

const mapScheduleToConbotProgram =
  (authors: Map<RawGuest['uid'], RawGuest>, rooms: Map<RawRoom['tid'], RawRoom>, lines: Map<RawLine['tid'], RawLine>) =>
  (data: RawProgram): ConbotProgram => ({
    pid: data.pid,
    title: data.title,
    type: mapProgramTypeToText(data.type),
    programLine: data.programLines.map((line) => lines.get(line)?.name).join(', ') || 'UNDEFINED',
    location:
      typeof rooms.get(data.location)?.name === 'undefined'
        ? 'UNDEFINED'
        : `${rooms.get(data.location)?.name}${
            rooms.get(data.location)?.description ? ` (${rooms.get(data.location)?.description})` : ''
          }`,
    startTime: rewriteTimezone(data.startTime),
    endTime: rewriteTimezone(data.endTime),
    annotation: data.annotation,
    summary: data.summary,
    speaker: data.authors?.map((author: number) => authors.get(author)?.name).join(', '),
    highlight: data.highlight ?? false,
    color: data.programLines.map((line) => lines.get(line)?.color).at(0) || 'transparent',
    weight: rooms.get(data.location)?.weight ?? 9999
  })

const programToXML = (p: ConbotProgram): string => `    <programme highlight="${p.highlight}" color="${p.color}">
      <pid><![CDATA[ ${p.pid} ]]></pid>
      <speaker><![CDATA[ ${p.speaker} ]]></speaker>
      <title><![CDATA[ ${p.title} ]]></title>
      <type><![CDATA[ ${p.type} ]]></type>
      <program-line><![CDATA[ ${p.programLine} ]]></program-line>
      <location${slavconData.parallelEventsRooms.includes(p.location) ? ' parallel-events="true"' : ''}><![CDATA[ ${
  p.location
} ]]></location>
      <start-time>${p.startTime}</start-time>
      <end-time>${p.endTime}</end-time>
      <annotation><![CDATA[ ${p.annotation} ]]></annotation>
    </programme>`

const extraProgramToXML = (p: ConbotProgram): string => `    <programme highlight="${p.highlight}" color="${p.color}">
      <id><![CDATA[ ${p.pid} ]]></id>
      <title><![CDATA[ ${p.title} ]]></title>
      ${p.speaker ? `<enterpreneur><![CDATA[ ${p.speaker} ]]></enterpreneur>` : ''}
      <annotation><![CDATA[ ${p.annotation} ]]></annotation>
      <description><![CDATA[ ${p.summary}<br/>${p.location !== 'UNDEFINED' ? `<strong>${p.location}</strong>, ` : ''}${
  p.type
}, ${p.programLine}<br/> ]]></description>
    </programme>`

const feedbackXML = () => {
  if (!feedbackForm.enabled) {
    return ''
  }

  return `  <dotaznik-spokojenosti>
    <title><![CDATA[ ${feedbackForm.title} ]]></title>
    <annotation><![CDATA[ ${feedbackForm.description} ]]></annotation>
    <image><![CDATA[ ${feedbackForm.image} ]]></image>
    <link><![CDATA[ ${feedbackForm.link} ]]></link>
  </dotaznik-spokojenosti>`
}

const convertToXML = (program: ConbotProgram[], extraProgram: ConbotProgram[], lastUpdate: string) => {
  return `<event last-update="${lastUpdate}">
  <annotations count="${program.length}">
  ${program.map(programToXML).join('\n')}
   </annotations>
   <extra-program>
   ${extraProgram.map(extraProgramToXML).join('\n')}
   </extra-program>
   <planek>
   ${floorPlan
     .map(
       (f) => `      <figure>
      <title><![CDATA[ ${f.title} ]]></title>
      <description><![CDATA[ ${f.description} ]]></description>
      <image><![CDATA[ ${f.image} ]]></image>
   </figure>`
     )
     .join('\n')}
   </planek>
   <event-info>
      <title><![CDATA[ ${slavconData.title} ]]></title>
      <description><![CDATA[ ${slavconData.description} ]]></description>
      <web-url><![CDATA[ ${slavconData.webUrl} ]]></web-url>
      <fb-url><![CDATA[ ${slavconData.fbUrl} ]]></fb-url>
   </event-info>
   ${feedbackXML()}
</event>`
}

export const getConbotFormat = async (year: number) => {
  const [schedule, scheduleExtra, authors, yearTid] = await Promise.all([
    loadSchedule(year),
    loadScheduleExtra(year),
    loadAuthors(year),
    loadYearTid(year)
  ])
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

  const lastUpdate = [...schedule, ...scheduleExtra].reduce(
    (last, { changed }) => (changed.localeCompare(last) > 0 ? changed : last),
    schedule[0].changed
  )

  const mappedProgram = schedule
    .map(mapScheduleToConbotProgram(authorsMap, roomsMap, linesMap))
    .filter(({ location }) => location !== 'UNDEFINED')
    .sort((a, b) => a.weight - b.weight)
  const mappedProgramExtra = scheduleExtra.map(mapScheduleToConbotProgram(authorsMap, roomsMap, linesMap))

  return convertToXML(mappedProgram, mappedProgramExtra, lastUpdate)
}
