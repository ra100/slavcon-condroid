import {
  loadSchedule,
  loadAuthors,
  loadYearTid,
  loadRooms,
  loadLines,
  RawGuest,
  RawLine,
  RawRoom,
  SlavconProgramType,
  RawProgram
} from '../../utils/loadProgram'

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
enum CondroidProgramType {
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

interface CondroidProgram {
  pid: number
  author: string
  title: string
  type: CondroidProgramType
  programLine: string
  location: string
  startTime: string
  endTime: string
  annotation: string
}

const mapProgramType = (programTypeTid: number) =>
  ({
    [SlavconProgramType.TALK]: CondroidProgramType.TALK,
    [SlavconProgramType.DISCUSSION]: CondroidProgramType.DISCUSSION,
    [SlavconProgramType.WORKSHOP]: CondroidProgramType.WORKSHOP,
    [SlavconProgramType.GAME]: CondroidProgramType.QUIZ,
    [SlavconProgramType.PERFORMANCE]: CondroidProgramType.PERFORMANCE,
    [SlavconProgramType.COMPETITION]: CondroidProgramType.COMPETITION,
    [SlavconProgramType.OTHER]: CondroidProgramType.TALK
  }[programTypeTid] || CondroidProgramType.TALK)

const mapScheduleToCondroidProgram =
  (authors: Map<RawGuest['uid'], RawGuest>, rooms: Map<RawRoom['tid'], RawRoom>, lines: Map<RawLine['tid'], RawLine>) =>
  (data: RawProgram): CondroidProgram => ({
    pid: data.pid,
    title: data.title,
    type: data.type.map(mapProgramType).at(0) ?? CondroidProgramType.TALK,
    programLine: data.programLines.map((line) => lines.get(line)?.name).at(0) || 'UNDEFINED',
    location: rooms.get(data.location)?.name || 'UNDEFINED',
    startTime: data.startTime,
    endTime: data.endTime,
    annotation: data.annotation,
    author: data.authors?.map((author: number) => authors.get(author)?.name).join(', ') || 'UNDEFINED'
  })

const convertToXML = (program: CondroidProgram[]) => {
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

  const mappedProgram = schedule.map(mapScheduleToCondroidProgram(authorsMap, roomsMap, linesMap))

  return convertToXML(mappedProgram)
}
