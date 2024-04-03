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
  pid: number
  speaker: string
  title: string
  type: string
  programLine: string
  location: string
  startTime: string
  endTime: string
  annotation: string
  highlight: boolean
}

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

const mapScheduleToConbotProgram =
  (authors: Map<RawGuest['uid'], RawGuest>, rooms: Map<RawRoom['tid'], RawRoom>, lines: Map<RawLine['tid'], RawLine>) =>
  (data: RawProgram): ConbotProgram => ({
    pid: data.pid,
    title: data.title,
    type: mapProgramTypeToText(data.type),
    programLine: data.programLines.map((line) => lines.get(line)?.name).join(', ') || 'UNDEFINED',
    location: rooms.get(data.location)?.name || 'UNDEFINED',
    startTime: data.startTime,
    endTime: data.endTime,
    annotation: data.annotation,
    speaker: data.authors?.map((author: number) => authors.get(author)?.name).join(', ') || 'UNDEFINED',
    highlight: data.highlight ?? false
  })

const programToXML = (p: ConbotProgram): string => `    <programme highlight="${p.highlight}">
      <pid><![CDATA[ ${p.pid} ]]></pid>
      <speaker><![CDATA[ ${p.speaker} ]]></speaker>
      <title><![CDATA[ ${p.title} ]]></title>
      <type><![CDATA[ ${p.type} ]]></type>
      <programLine><![CDATA[ ${p.programLine} ]]></programLine>
      <location><![CDATA[ ${p.location} ]]></location>
      <startTime>${p.startTime}</startTime>
      <endTime>${p.endTime}</endTime>
      <annotation><![CDATA[ ${p.annotation} ]]></annotation>
    </programme>`

const floorPlan = [
  { title: 'budova', description: '', image: 'https://slavcon.sk/sites/default/files/uploads/2023/mapka4.svg' }
]

const convertToXML = (program: ConbotProgram[], extraProgram: ConbotProgram[], lastUpdate: string) => {
  return `<event last-update="${lastUpdate}">
  <annotations count="${program.length}">
  ${program.map(programToXML).join('\n')}
   </annotations>
   <extra-program>
   ${extraProgram.map(programToXML).join('\n')}
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

  const mappedProgram = schedule.map(mapScheduleToConbotProgram(authorsMap, roomsMap, linesMap))
  const mappedProgramExtra = scheduleExtra.map(mapScheduleToConbotProgram(authorsMap, roomsMap, linesMap))

  return convertToXML(mappedProgram, mappedProgramExtra, lastUpdate)
}
