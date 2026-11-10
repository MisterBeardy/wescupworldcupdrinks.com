'use client'
import { Drink } from '@/lib/types'

interface Props {
  drink: Drink
  className?: string
}

export default function DrinkLink({ drink, className = '' }: Props) {
  return (
    <a
      href={drink.wiki}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className={`text-accent-text underline decoration-dotted decoration-1 underline-offset-2 hover:decoration-solid ${className}`}
    >
      {drink.drink}
    </a>
  )
}
