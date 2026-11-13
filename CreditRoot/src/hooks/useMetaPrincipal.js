// src/hooks/useMetaPrincipal.js
//
// Meta principal del usuario desde GET /api/metas.
// meta === null (y cargando === false) significa que todavía no tiene metas.

import { useEffect, useState } from 'react'
import { listarMetas } from '../lib/endpoints'
import { elegirMetaPrincipal } from '../lib/mappers'

export function useMetaPrincipal() {
  const [meta, setMeta] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelado = false
    listarMetas()
      .then((metas) => { if (!cancelado) setMeta(elegirMetaPrincipal(metas)) })
      .catch((err) => { if (!cancelado) setError(err) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  return { meta, setMeta, cargando, error }
}
