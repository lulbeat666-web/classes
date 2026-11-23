import {
  Dice5, Footprints, Shapes, ArrowLeftRight, Search,
  Flag, Drama, Library,
} from 'lucide-react'
import type { LessonInput } from './shared/contracts'

export const defaultLesson: LessonInput = {
  grade: 5,
  subject: '수학',
  objective: '',
  textbookContent: '',
  durationMinutes: 15,
  durationMode: 'exact',
  materials: 'none',
  preparationMinutes: 5,
  groupSize: 28,
  mechanisms: [],
}

export const mechanismIcons = {
  random: Dice5,
  movement: Footprints,
  craft: Shapes,
  exchange: ArrowLeftRight,
  mystery: Search,
  challenge: Flag,
  roleplay: Drama,
  collection: Library,
}

export const materialOptions = [
  { id: 'none', label: '교과서·공책·필기구만' },
  { id: 'print', label: '간단한 인쇄물까지' },
  { id: 'basic', label: '색종이·포스트잇 등 기본 교구까지' },
] as const

export const durations = Array.from({ length: 11 }, (_, index) => 10 + index * 5)
