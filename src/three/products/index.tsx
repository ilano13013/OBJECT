import type { ProceduralModelId } from '@/showroom/types'
import { AuraBottle } from './AuraBottle'
import { FormCuff } from './FormCuff'
import { MonoVase } from './MonoVase'

export function ProceduralModel({ id, lite }: { id: ProceduralModelId; lite?: boolean }) {
  switch (id) {
    case 'aura-bottle':
      return <AuraBottle lite={lite} />
    case 'form-cuff':
      return <FormCuff />
    case 'mono-vase':
      return <MonoVase />
  }
}

export { AuraBottle, FormCuff, MonoVase }
