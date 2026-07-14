import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Building, Location, Department, User } from '../../../types/index'
import type { UserRole } from '../../../types/index'
import { useModalHotkeys } from '../../../hooks/useModalHotkeys'
import {
  getUsers, createUser, updateUser, importUsers, updateUserRole,
  assignUserBuildings, deleteUser,
} from '../../../api/users'
import { toggleUserSpecialAccess } from '../../../api/settings'
import { getBuildings } from '../../../api/buildings'
import { getLocations } from '../../../api/locations'
import { getDepartments } from '../../../api/departments'
import UserAvatar from '../../ui/UserAvatar'
import WifiLoader from '../../ui/WifiLoader'
import { useAuth } from '../../../context/AuthContext'
import { useCancelToast } from '../../../context/CancelToastContext'
import { ModalPortal, InfoTooltip } from '../shared'
import { ROLE_META, ALL_ROLES } from './roleMeta'
import AddUserModal, { DefaultBuildingSelect, BuildingPicker } from './AddUserModal'
import ImportExportModal, { type ImportRow } from './ImportExportModal'
import DepartmentsSection from './DepartmentsSection'

function PerPageDropdown({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function place() {
      const r = btnRef.current?.getBoundingClientRect()
      if (!r) return
      setPos({ top: r.bottom + 6, left: r.right - 96 })
    }
    place()
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 pl-3 pr-2 py-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-bg-surface)] text-[11px] font-black text-[var(--ds-text-1)] hover:bg-[var(--ds-bg-surface-2)] transition-colors">
        {value}
        <span className="material-symbols-outlined transition-transform duration-200" style={{ fontSize: 15, transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </button>
      {open && createPortal(
        <div ref={panelRef} className="fixed z-[400] rounded-xl p-1 flex flex-col min-w-[96px] dropdown-enter"
          style={{
            top: pos.top, left: pos.left,
            background: 'var(--ds-glass-bg)', backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid var(--ds-glass-border)', boxShadow: 'var(--ds-glass-shadow)',
          }}>
          {options.map(o => (
            <button key={o} onClick={() => { onChange(o); setOpen(false) }}
              className={`px-3 py-2 rounded-lg text-left text-[11px] font-black transition-colors ${o === value ? 'bg-black text-[#adee2b]' : 'text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)]'}`}>
              {o}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

function pageWindow(page: number, totalPages: number, size = 5): number[] {
  if (totalPages <= size) return Array.from({ length: totalPages }, (_, i) => i + 1)
  let start = Math.max(1, page - Math.floor(size / 2))
  const end = Math.min(totalPages, start + size - 1)
  start = Math.max(1, end - size + 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

type UserSortKey = 'name' | 'email' | 'department' | 'ext' | 'default_building' | 'special_access' | 'buildings' | 'created_at' | 'updated_at'

function SortableTh({ label, sortKey, sort, onSort, className = '', info }: {
  label: string
  sortKey: UserSortKey
  sort: { key: UserSortKey; dir: 'asc' | 'desc' }
  onSort: (key: UserSortKey) => void
  className?: string
  info?: string
}) {
  const active = sort.key === sortKey
  return (
    <th className={`px-5 py-3 text-[10px] font-black uppercase tracking-wider ${className}`}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={`flex items-center gap-1 transition-colors hover:text-[var(--ds-text-1)] ${active ? 'text-[var(--ds-text-1)]' : 'text-[var(--ds-text-3)]'}`}
        >
          {label}
          <span className="material-symbols-outlined" style={{ fontSize: 13, opacity: active ? 1 : 0.35 }}>
            {active ? (sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
          </span>
        </button>
        {info && <InfoTooltip text={info} />}
      </div>
    </th>
  )
}

function UserPaginationBar({ page, totalPages, perPage, onPage, onPerPage, total, showPerPage }: {
  page: number; totalPages: number; perPage: string
  onPage: (p: number) => void; onPerPage: (p: string) => void
  total: number; showPerPage: boolean
}) {
  const pages = useMemo(() => pageWindow(page, totalPages, 5), [page, totalPages])
  const perPageN = Number(perPage)

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3">
      <p className="text-[11px] font-bold text-[var(--ds-text-3)] whitespace-nowrap">
        {total === 0 ? 'No users' : `Showing ${(page - 1) * perPageN + 1}–${Math.min(page * perPageN, total)} of ${total}`}
      </p>
      <div className="flex items-center gap-4 flex-wrap">
        {showPerPage && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider whitespace-nowrap">Per page</span>
            <PerPageDropdown value={perPage} onChange={onPerPage} options={['25', '50', '100', '200', '500']} />
          </div>
        )}
        <div className="flex items-center gap-1">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}
            className="size-8 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)] disabled:opacity-30 disabled:pointer-events-none transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
          </button>
          {pages.map(p => (
            <button key={p} onClick={() => onPage(p)}
              className={`min-w-8 h-8 px-2 flex items-center justify-center rounded-lg text-[11px] font-black transition-colors ${p === page ? 'bg-black text-[#adee2b]' : 'text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)]'}`}>
              {p}
            </button>
          ))}
          <button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
            className="size-8 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)] disabled:opacity-30 disabled:pointer-events-none transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function UsersTab() {
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const { addInfoToast } = useCancelToast()
  const isReadOnly = currentUser?.role === 'building_admin'
  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ['users'], queryFn: getUsers })
  const { data: buildings = [] } = useQuery<Building[]>({ queryKey: ['buildings'], queryFn: getBuildings })
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: getLocations })
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ['departments'], queryFn: getDepartments })

  const [editUser, setEditUser]         = useState<User | null>(null)
  const [roleValue, setRoleValue]       = useState<UserRole>('user')
  const [bldIds, setBldIds]             = useState<number[]>([])
  const [saving, setSaving]             = useState(false)
  const editScrollBodyRef = useRef<HTMLDivElement>(null)

  function fmtUserDate(iso?: string) {
    if (!iso) return '—'
    return new Date(iso.replace('Z', '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function selectEditRole(r: UserRole, blocked: boolean) {
    if (blocked) return
    setRoleValue(r)
    if (r !== 'admin') {
      setTimeout(() => editScrollBodyRef.current?.scrollTo({ top: editScrollBodyRef.current.scrollHeight, behavior: 'smooth' }), 50)
    }
  }
  const [search, setSearch]             = useState('')
  const [addModal, setAddModal]         = useState(false)
  const [importExportModal, setIEModal] = useState(false)
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null)
  const [confirmUserInput, setConfirmUserInput] = useState('')
  const [deletingUser, setDeletingUser]         = useState(false)
  const [deleteUserErr, setDeleteUserErr]       = useState('')
  const [deleteBlockedUser, setDeleteBlockedUser] = useState<User | null>(null)
  const [selectedIds, setSelectedIds]           = useState<Set<number>>(new Set())
  const [batchDeleteOpen, setBatchDeleteOpen]   = useState(false)
  const [batchConfirmInput, setBatchConfirmInput] = useState('')
  const [batchDeleting, setBatchDeleting]       = useState(false)
  const [batchDeleteErr, setBatchDeleteErr]     = useState('')
  const [editName, setEditName]               = useState('')
  const [editEmail, setEditEmail]             = useState('')
  const [editAlias, setEditAlias]             = useState('')
  const [editDeptId, setEditDeptId]           = useState<number | null>(null)
  const [editExt, setEditExt]                 = useState('')
  const [editPw, setEditPw]                   = useState('')
  const [editConfirmPw, setEditConfirmPw]     = useState('')
  const [editShowPw, setEditShowPw]           = useState(false)
  const [editErr, setEditErr]                 = useState('')
  const [editDefaultBldId, setEditDefaultBldId] = useState<number | null>(null)

  function openEdit(u: User) {
    setEditUser(u)
    setRoleValue(u.role)
    setBldIds((u.admin_buildings ?? []).map(b => b.id))
    setEditDefaultBldId(u.default_building_id ?? null)
    setEditName(u.name)
    setEditEmail(u.email)
    setEditAlias(u.alias ?? '')
    setEditDeptId(u.department_id ?? null)
    setEditExt(u.ext ?? '')
    setEditPw('')
    setEditConfirmPw('')
    setEditShowPw(false)
    setEditErr('')
  }

  async function handleSave() {
    if (!editUser) return
    if (!editName.trim() || !editEmail.trim()) { setEditErr('Name and email are required'); return }
    if (editPw && editPw.length < 8) { setEditErr('Password must be at least 8 characters'); return }
    if (editPw && editPw !== editConfirmPw) { setEditErr('Passwords do not match'); return }
    setSaving(true); setEditErr('')
    try {
      await updateUser(editUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        alias: editAlias.trim() || null,
        department_id: editDeptId,
        ext: editExt.trim() || undefined,
        ...(editPw ? { password: editPw } : {}),
      })
      await updateUserRole(editUser.id, roleValue)
      if (roleValue !== 'admin') {
        await assignUserBuildings(editUser.id, bldIds, editDefaultBldId)
      }
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditUser(null)
    } catch (e: unknown) {
      const resp = (e as { response?: { data?: { message?: string; errors?: { name?: string[]; email?: string[]; alias?: string[] } } } })?.response?.data
      setEditErr(resp?.errors?.name?.[0] ?? resp?.errors?.email?.[0] ?? resp?.errors?.alias?.[0] ?? resp?.message ?? 'Failed to save changes.')
    } finally { setSaving(false) }
  }

  useModalHotkeys(!!editUser, handleSave, () => setEditUser(null))

  function toggleBuilding(id: number) {
    setBldIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleAddUser(data: Parameters<typeof createUser>[0] & { building_ids: number[]; default_building_id: number | null }) {
    const { building_ids, default_building_id, ...userData } = data
    const user = await createUser(userData)
    qc.invalidateQueries({ queryKey: ['users'] })
    if (userData.role !== 'admin' && (building_ids.length > 0 || default_building_id != null)) {
      try { await assignUserBuildings(user.id, building_ids, default_building_id) } catch { /* non-fatal */ }
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserTarget) return
    setDeletingUser(true); setDeleteUserErr('')
    try {
      await deleteUser(deleteUserTarget.id)
      qc.invalidateQueries({ queryKey: ['users'] })
      setDeleteUserTarget(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteUserErr(msg ?? 'Failed to delete user.')
    } finally { setDeletingUser(false) }
  }

  useModalHotkeys(
    !!deleteUserTarget,
    deleteUserTarget && confirmUserInput === deleteUserTarget.name ? handleDeleteUser : undefined,
    () => { setDeleteUserTarget(null); setConfirmUserInput('') },
  )

  // ── Multi-select batch delete (Data User Reguler subpage) ──
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleBatchDelete() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBatchDeleting(true); setBatchDeleteErr('')
    const errors: string[] = []
    for (const id of ids) {
      try { await deleteUser(id) }
      catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        const u = (users as User[]).find(x => x.id === id)
        errors.push(`${u?.name ?? id}: ${msg ?? 'failed to delete'}`)
      }
    }
    qc.invalidateQueries({ queryKey: ['users'] })
    setBatchDeleting(false)
    if (errors.length === 0) {
      addInfoToast(`${ids.length} user${ids.length !== 1 ? 's' : ''} deleted`)
      setSelectedIds(new Set())
      setBatchDeleteOpen(false)
      setBatchConfirmInput('')
    } else {
      setBatchDeleteErr(`${ids.length - errors.length}/${ids.length} deleted. ${errors.join('; ')}`)
    }
  }

  useModalHotkeys(
    batchDeleteOpen,
    batchConfirmInput === 'DELETE' ? handleBatchDelete : undefined,
    () => { setBatchDeleteOpen(false); setBatchConfirmInput(''); setBatchDeleteErr('') },
  )

  async function handleImport(rows: ImportRow[]) {
    const result = await importUsers(rows)
    qc.invalidateQueries({ queryKey: ['users'] })
    return result
  }

  const filtered = useMemo(() =>
    (users as User[]).filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.alias?.toLowerCase().includes(search.toLowerCase()) || u.department?.toLowerCase().includes(search.toLowerCase()))
  , [users, search])

  // ── Column sorting — shared across every role table (user/admin/building_admin/receptionist) ──
  const [sortKey, setSortKey] = useState<UserSortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  function onSort(key: UserSortKey) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }
  const compareUsers = useCallback((a: User, b: User): number => {
    switch (sortKey) {
      case 'name': return a.name.localeCompare(b.name)
      case 'email': return a.email.localeCompare(b.email)
      case 'department': return (a.department || '').localeCompare(b.department || '')
      case 'ext': return (a.ext || '').localeCompare(b.ext || '')
      case 'default_building': {
        const an = a.default_building_id != null ? (buildings as Building[]).find(x => x.id === a.default_building_id)?.name ?? '' : ''
        const bn = b.default_building_id != null ? (buildings as Building[]).find(x => x.id === b.default_building_id)?.name ?? '' : ''
        return an.localeCompare(bn)
      }
      case 'special_access': return Number(a.can_book_special) - Number(b.can_book_special)
      case 'buildings': {
        const an = (a.admin_buildings ?? []).map(x => x.name).sort().join(',')
        const bn = (b.admin_buildings ?? []).map(x => x.name).sort().join(',')
        return an.localeCompare(bn)
      }
      case 'created_at': return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      case 'updated_at': return new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime()
      default: return 0
    }
  }, [sortKey, buildings])

  const grouped = useMemo(() => {
    const g: Partial<Record<UserRole, User[]>> = {}
    filtered.forEach(u => { if (!g[u.role]) g[u.role] = []; g[u.role]!.push(u) })
    const dir = sortDir === 'asc' ? 1 : -1
    Object.values(g).forEach(arr => arr!.sort((a, b) => compareUsers(a, b) * dir))
    return g
  }, [filtered, sortDir, compareUsers])

  // ── "User (Reguler)" subpage — the role='user' table lives on its own drill-down view ──
  const [regularView, setRegularView] = useState(false)

  // ── Pagination — Data User Reguler (role='user') table only ──
  const [regularPage, setRegularPage]       = useState(1)
  const [regularPerPage, setRegularPerPage] = useState('25')
  const regularUsers    = grouped.user ?? []
  const regularPerPageN = Number(regularPerPage)
  const regularTotalPages = Math.max(1, Math.ceil(regularUsers.length / regularPerPageN))
  const regularPageClamped = Math.min(regularPage, regularTotalPages)
  const regularPageRows = regularUsers.slice((regularPageClamped - 1) * regularPerPageN, regularPageClamped * regularPerPageN)

  useEffect(() => { setRegularPage(1) }, [search, regularPerPage, sortKey, sortDir])
  useEffect(() => { setSelectedIds(new Set()) }, [search, regularView])

  return (
    <div className="space-y-5 w-full max-w-[1600px]">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {regularView ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setRegularView(false)}
                className="size-8 flex items-center justify-center rounded-xl text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)] transition-colors shrink-0">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
              </button>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Management User</p>
                <h1 className="text-3xl font-black italic tracking-tighter uppercase">User (Reguler)</h1>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--ds-text-3)] mb-1">Management</p>
              <h1 className="text-3xl font-black italic tracking-tighter uppercase">Users</h1>
            </>
          )}
        </div>
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] pointer-events-none" style={{ fontSize: 16 }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-56 bg-[var(--ds-bg-surface)] border border-[var(--ds-border)] rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] focus:border-transparent text-[var(--ds-text-1)]" />
        </div>
        {!isReadOnly && (<>
        {/* Import / Export */}
        <button onClick={() => setIEModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] text-[11px] font-black uppercase hover:bg-[var(--ds-bg-raised)] transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>import_export</span>
          Import / Export
        </button>
        {/* Add User */}
        <button onClick={() => setAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-[#adee2b] text-[11px] font-black uppercase hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
          Add User
        </button>
        </>)}
      </div>

      {/* ── Departments section — admin only, hidden while inside the User (Reguler) subpage ── */}
      {!isReadOnly && !regularView && <DepartmentsSection departments={departments as Department[]} locations={locations as Location[]} qc={qc} />}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <WifiLoader />
        </div>
      ) : (
        <div className="space-y-4">
          {!regularView && grouped.user?.length ? (
            <div className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase ${ROLE_META.user.bg} ${ROLE_META.user.text}`}>{ROLE_META.user.label}</span>
                  <span className="text-[11px] font-black text-[var(--ds-text-3)]">{grouped.user.length} user{grouped.user.length !== 1 ? 's' : ''}</span>
                </div>
                <button onClick={() => setRegularView(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-[#adee2b] text-[11px] font-black uppercase hover:bg-slate-800 transition-colors">
                  Open User (Reguler)
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>arrow_forward</span>
                </button>
              </div>
            </div>
          ) : null}

          {(regularView ? (['user'] as UserRole[]) : ALL_ROLES.filter(r => r !== 'user')).filter(r => grouped[r]?.length).map(role => {
            const m = ROLE_META[role]
            const isUserRole = role === 'user'
            return (
              <div key={role} className="bg-[var(--ds-bg-surface)] rounded-2xl border border-[var(--ds-border-sub)] overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--ds-border-sub)] flex-wrap">
                  <span className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase ${m.bg} ${m.text}`}>{m.label}</span>
                  <span className="text-[11px] font-black text-[var(--ds-text-3)]">{grouped[role]!.length} user{grouped[role]!.length !== 1 ? 's' : ''}</span>
                  {isUserRole && !isReadOnly && selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[11px] font-bold text-[var(--ds-text-2)]">{selectedIds.size} selected</span>
                      <button onClick={() => setSelectedIds(new Set())}
                        className="text-[10px] font-black uppercase tracking-wider text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)] transition-colors px-2 py-1.5">
                        Clear
                      </button>
                      <button onClick={() => { setBatchDeleteErr(''); setBatchConfirmInput(''); setBatchDeleteOpen(true) }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase hover:bg-red-600 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                        Delete Selected
                      </button>
                    </div>
                  )}
                </div>

                {isUserRole && regularUsers.length > 0 && (
                  <div className="border-b border-[var(--ds-border-sub)]">
                    <UserPaginationBar page={regularPageClamped} totalPages={regularTotalPages} perPage={regularPerPage}
                      onPage={setRegularPage} onPerPage={setRegularPerPage} total={regularUsers.length} showPerPage />
                  </div>
                )}

                {isUserRole ? (
                  /* Table layout for role='user' */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[var(--ds-border-sub)]">
                          {!isReadOnly && <th className="px-4 py-3 w-8"></th>}
                          <th className="px-5 py-3 text-[10px] font-black uppercase text-[var(--ds-text-3)] tracking-wider w-10">No.</th>
                          <SortableTh label="Name" sortKey="name" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} />
                          <SortableTh label="Email" sortKey="email" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} />
                          <SortableTh label="Department" sortKey="department" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} />
                          <SortableTh label="Ext" sortKey="ext" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} className="w-20" />
                          {role === 'user' && <SortableTh label="Default Building" sortKey="default_building" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} />}
                          {role === 'user' && <SortableTh label="Special Access" sortKey="special_access" sort={{ key: sortKey, dir: sortDir }} onSort={onSort}
                            info="Grants this user permission to book Special rooms — rooms that normally require contacting the Receptionist or GAA team." />}
                          <SortableTh label="Date Created" sortKey="created_at" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} className="whitespace-nowrap" />
                          <SortableTh label="Date Edited" sortKey="updated_at" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} className="whitespace-nowrap" />
                          <th className="px-2 py-3 w-10"></th>
                          <th className="px-2 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {regularPageRows.map((u, i) => (
                          <tr key={u.id} className={`hover:bg-[var(--ds-bg-raised)] transition-colors ${i < regularPageRows.length - 1 ? 'border-b border-[var(--ds-border-sub)]' : ''} ${selectedIds.has(u.id) ? 'bg-red-500/[0.04]' : ''}`}>
                            {!isReadOnly && (
                              <td className="px-4 py-3.5">
                                <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)}
                                  className="size-4 rounded accent-black cursor-pointer" />
                              </td>
                            )}
                            <td className="px-5 py-3.5 text-[11px] font-bold text-[var(--ds-text-3)]">{(regularPageClamped - 1) * regularPerPageN + i + 1}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <UserAvatar name={u.name} avatar={u.avatar} size={32} />
                                <span className="text-[13px] font-black text-[var(--ds-text-1)] whitespace-nowrap">{u.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-[var(--ds-text-3)] font-medium">
                              <div>{u.email}</div>
                              {u.alias && <div className="text-[10px] text-[var(--ds-text-4)]">@{u.alias}</div>}
                            </td>
                            <td className="px-5 py-3.5">
                              {u.department ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="text-[12px] font-black text-[var(--ds-text-1)] uppercase">{u.department}</span>
                                  {u.department_location && (
                                    <span className="text-[10px] font-bold text-[var(--ds-text-3)]">
                                      | {u.department_location.code ?? u.department_location.name}
                                    </span>
                                  )}
                                </span>
                              ) : <span className="text-[var(--ds-text-4)]">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-[12px] text-[var(--ds-text-3)] font-medium">{u.ext || '—'}</td>
                            {role === 'user' && (() => {
                              const bld = u.default_building_id != null ? (buildings as Building[]).find(b => b.id === u.default_building_id) : null
                              return (
                                <td className="px-5 py-3.5">
                                  {bld ? (
                                    <span className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-black text-[var(--ds-text-1)]">{bld.name}</span>
                                      {bld.code && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: 'var(--ds-bg-raised)', color: 'var(--ds-text-3)' }}>{bld.code}</span>}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-[var(--ds-text-4)] font-medium">—</span>
                                  )}
                                </td>
                              )
                            })()}
                            {role === 'user' && (
                              <td className="px-5 py-3.5">
                                <button
                                  disabled={isReadOnly}
                                  onClick={async () => { await toggleUserSpecialAccess(u.id); qc.invalidateQueries({ queryKey: ['users'] }) }}
                                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-[11px] font-black uppercase tracking-wider whitespace-nowrap"
                                  style={u.can_book_special
                                    ? { background: 'rgba(173,238,43,0.1)', borderColor: 'rgba(173,238,43,0.4)', color: '#4d7c00' }
                                    : { background: 'var(--ds-bg-surface)', borderColor: 'var(--ds-border)', color: '#94a3b8' }
                                  }
                                  onMouseEnter={e => {
                                    const b = e.currentTarget
                                    if (u.can_book_special) { b.style.background = 'rgba(239,68,68,0.08)'; b.style.borderColor = 'rgba(239,68,68,0.35)'; b.style.color = '#dc2626' }
                                    else { b.style.background = 'rgba(173,238,43,0.08)'; b.style.borderColor = 'rgba(173,238,43,0.4)'; b.style.color = '#4d7c00' }
                                  }}
                                  onMouseLeave={e => {
                                    const b = e.currentTarget
                                    if (u.can_book_special) { b.style.background = 'rgba(173,238,43,0.1)'; b.style.borderColor = 'rgba(173,238,43,0.4)'; b.style.color = '#4d7c00' }
                                    else { b.style.background = 'var(--ds-bg-surface)'; b.style.borderColor = 'var(--ds-border)'; b.style.color = '#94a3b8' }
                                  }}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: u.can_book_special ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                                  {u.can_book_special ? 'Special' : 'Grant Access'}
                                </button>
                              </td>
                            )}
                            <td className="px-5 py-3.5 text-[11px] text-[var(--ds-text-3)] font-medium whitespace-nowrap">{fmtUserDate(u.created_at)}</td>
                            <td className="px-5 py-3.5 text-[11px] text-[var(--ds-text-3)] font-medium whitespace-nowrap">{fmtUserDate(u.updated_at)}</td>
                            <td className="px-2 py-3.5">
                              {!isReadOnly && (
                                <button onClick={() => openEdit(u)}
                                  className="size-8 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)] transition-colors">
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                </button>
                              )}
                            </td>
                            <td className="px-2 py-3.5">
                              {!isReadOnly && (
                                <button onClick={() => { setDeleteUserTarget(u); setConfirmUserInput(''); setDeleteUserErr('') }}
                                  className="size-8 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {isUserRole && regularUsers.length > 0 && (
                  <div className="border-t border-[var(--ds-border-sub)]">
                    <UserPaginationBar page={regularPageClamped} totalPages={regularTotalPages} perPage={regularPerPage}
                      onPage={setRegularPage} onPerPage={setRegularPerPage} total={regularUsers.length} showPerPage={false} />
                  </div>
                )}

                {!isUserRole && (
                  /* Table layout for admin/building_admin/receptionist — mirrors the regular-user table so every role group lines up in the same neat columns */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left table-fixed">
                      <colgroup>
                        <col className="w-[26%]" />
                        <col className="w-[16%]" />
                        <col className="w-[28%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-10" />
                        <col className="w-10" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-[var(--ds-border-sub)]">
                          <SortableTh label="Name" sortKey="name" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} />
                          <SortableTh label="Department" sortKey="department" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} />
                          <SortableTh label="Buildings" sortKey="buildings" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} />
                          <SortableTh label="Date Created" sortKey="created_at" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} className="whitespace-nowrap" />
                          <SortableTh label="Date Edited" sortKey="updated_at" sort={{ key: sortKey, dir: sortDir }} onSort={onSort} className="whitespace-nowrap" />
                          <th className="px-2 py-3"></th>
                          <th className="px-2 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped[role]!.map((u, i) => (
                          <tr key={u.id} className={`hover:bg-[var(--ds-bg-raised)] transition-colors ${i < grouped[role]!.length - 1 ? 'border-b border-[var(--ds-border-sub)]' : ''}`}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <UserAvatar name={u.name} avatar={u.avatar} size={32} />
                                <div className="min-w-0">
                                  <p className="text-[13px] font-black text-[var(--ds-text-1)] truncate">{u.name}</p>
                                  <p className="text-[11px] text-[var(--ds-text-3)] font-medium truncate">{u.email}{u.alias && <span className="text-[var(--ds-text-4)]"> · @{u.alias}</span>}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              {u.department ? (
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[12px] font-black text-[var(--ds-text-1)] uppercase truncate">{u.department}</span>
                                  {u.department_location && (
                                    <span className="text-[10px] font-bold text-[var(--ds-text-3)] shrink-0">
                                      | {u.department_location.code ?? u.department_location.name}
                                    </span>
                                  )}
                                </span>
                              ) : <span className="text-[var(--ds-text-4)]">—</span>}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex gap-1.5 flex-wrap">
                                {(u.admin_buildings ?? []).length === 0
                                  ? <span className="text-[11px] text-orange-400 font-black uppercase">No buildings</span>
                                  : (u.admin_buildings ?? []).map(b => (
                                    <span key={b.id} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase">{b.name}</span>
                                  ))
                                }
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-[11px] text-[var(--ds-text-3)] font-medium whitespace-nowrap">{fmtUserDate(u.created_at)}</td>
                            <td className="px-5 py-3.5 text-[11px] text-[var(--ds-text-3)] font-medium whitespace-nowrap">{fmtUserDate(u.updated_at)}</td>
                            <td className="px-2 py-3.5">
                              {!isReadOnly && (
                                <button onClick={() => openEdit(u)}
                                  className="size-8 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-surface-2)] hover:text-[var(--ds-text-1)] transition-colors">
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                                </button>
                              )}
                            </td>
                            <td className="px-2 py-3.5">
                              {!isReadOnly && (
                                <button onClick={() => {
                                    const isLastAdmin = u.role === 'admin' && (users as User[]).filter(x => x.role === 'admin').length <= 1
                                    if (isLastAdmin) { setDeleteBlockedUser(u); return }
                                    setDeleteUserTarget(u); setConfirmUserInput(''); setDeleteUserErr('')
                                  }}
                                  className="size-8 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete blocked — last super admin */}
      {deleteBlockedUser && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1001] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => setDeleteBlockedUser(null)}>
          <div
            className="w-[400px] rounded-[2rem] shadow-2xl overflow-hidden"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>shield_lock</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">Action Blocked</p>
                <h3 className="text-lg font-black text-[var(--ds-text-1)] uppercase tracking-tight mt-0.5">Cannot Delete</h3>
              </div>
            </div>
            <div className="px-7 py-6 space-y-4">
              <div className="bg-[var(--ds-bg-raised)] rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="size-9 rounded-xl overflow-hidden shrink-0">
                  <UserAvatar name={deleteBlockedUser.name} avatar={deleteBlockedUser.avatar} size={40}
                    className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-black text-[var(--ds-text-1)]">{deleteBlockedUser.name}</p>
                  <p className="text-[10px] text-[var(--ds-text-3)] font-medium">{deleteBlockedUser.email}</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-black text-[#adee2b] shrink-0">Super Admin</span>
              </div>
              <p className="text-[12px] text-[var(--ds-text-2)] font-medium leading-relaxed">
                This is the <span className="font-black text-[var(--ds-text-1)]">only Super Admin</span> in the system. Deleting them would leave the system with no administrator.
              </p>
              <p className="text-[11px] text-[var(--ds-text-3)] font-medium leading-relaxed">
                Promote another user to Super Admin first, then come back to delete this account.
              </p>
              <button onClick={() => setDeleteBlockedUser(null)}
                className="w-full py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-black text-white hover:bg-slate-800 transition-colors">
                Got It
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Delete user confirm */}
      {deleteUserTarget && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1001] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { setDeleteUserTarget(null); setConfirmUserInput('') }}>
          <div
            className="w-[420px] rounded-[2rem] shadow-2xl overflow-hidden"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0 overflow-hidden">
                <UserAvatar name={deleteUserTarget.name} avatar={deleteUserTarget.avatar} size={40} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">Danger Zone</p>
                <h3 className="text-lg font-black text-[var(--ds-text-1)] uppercase tracking-tight mt-0.5">Delete User?</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4">
              <div className="bg-[var(--ds-bg-raised)] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--ds-text-3)] shrink-0" style={{ fontSize: 20 }}>person</span>
                <div>
                  <p className="text-sm font-black text-[var(--ds-text-1)]">{deleteUserTarget.name}</p>
                  <p className="text-[10px] text-[var(--ds-text-3)] font-medium mt-0.5">
                    {deleteUserTarget.email}
                    {deleteUserTarget.department ? ` · ${deleteUserTarget.department}` : ''}
                  </p>
                </div>
                <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${ROLE_META[deleteUserTarget.role].bg} ${ROLE_META[deleteUserTarget.role].text}`}>
                  {ROLE_META[deleteUserTarget.role].label}
                </span>
              </div>
              <p className="text-[11px] text-[var(--ds-text-2)] font-medium leading-relaxed">
                This account and all associated data will be permanently removed. <span className="font-black text-[var(--ds-text-1)]">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] px-1">
                  Type <span className="normal-case text-[var(--ds-text-1)]">"{deleteUserTarget.name}"</span> to confirm
                </label>
                <input
                  value={confirmUserInput}
                  onChange={e => setConfirmUserInput(e.target.value)}
                  placeholder={deleteUserTarget.name}
                  autoFocus
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent text-[var(--ds-text-1)]"
                />
              </div>
              {deleteUserErr && (
                <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>
                  {deleteUserErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setDeleteUserTarget(null); setConfirmUserInput('') }}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">
                  Cancel
                </button>
                <button onClick={handleDeleteUser} disabled={deletingUser || confirmUserInput !== deleteUserTarget.name}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 flex items-center justify-center gap-2 transition-all">
                  {deletingUser && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                  {deletingUser ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Batch delete confirm — "Batch Delete User" danger zone */}
      {batchDeleteOpen && (() => {
        const selectedUsers = (users as User[]).filter(u => selectedIds.has(u.id))
        return (
        <ModalPortal>
        <div className="fixed inset-0 z-[1001] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)' }}
          onClick={() => { if (!batchDeleting) { setBatchDeleteOpen(false); setBatchConfirmInput('') } }}>
          <div
            className="w-[460px] max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden"
            style={{ background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-7 pt-7 pb-5 border-b flex items-center gap-3 shrink-0" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.15)' }}>
              <div className="size-11 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-red-500" style={{ fontSize: 22 }}>delete_sweep</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">Danger Zone</p>
                <h3 className="text-lg font-black text-[var(--ds-text-1)] uppercase tracking-tight mt-0.5">Batch Delete User</h3>
              </div>
            </div>
            <div className="px-7 py-5 space-y-4 overflow-y-auto">
              <p className="text-[11px] text-[var(--ds-text-2)] font-medium leading-relaxed">
                <span className="font-black text-[var(--ds-text-1)]">{selectedUsers.length} account{selectedUsers.length !== 1 ? 's' : ''}</span> and all associated data will be permanently removed. <span className="font-black text-[var(--ds-text-1)]">This cannot be undone.</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] px-1">Who's selected</label>
                <div className="rounded-xl border border-[var(--ds-border-sub)] max-h-[200px] overflow-y-auto divide-y divide-[var(--ds-border-sub)]">
                  {selectedUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                      <UserAvatar name={u.name} avatar={u.avatar} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-black text-[var(--ds-text-1)] truncate">{u.name}</p>
                        <p className="text-[10px] text-[var(--ds-text-3)] font-medium truncate">{u.email}{u.department ? ` · ${u.department}` : ''}</p>
                      </div>
                      <button onClick={() => toggleSelect(u.id)} title="Remove from selection"
                        className="size-6 flex items-center justify-center rounded-lg text-[var(--ds-text-3)] hover:bg-[var(--ds-bg-raised)] hover:text-[var(--ds-text-1)] transition-colors shrink-0">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)] px-1">
                  Type <span className="normal-case text-[var(--ds-text-1)]">"DELETE"</span> to confirm
                </label>
                <input
                  value={batchConfirmInput}
                  onChange={e => setBatchConfirmInput(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  className="w-full bg-[var(--ds-bg-raised)] border border-[var(--ds-border)] rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent text-[var(--ds-text-1)]"
                />
              </div>
              {batchDeleteErr && (
                <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>
                  {batchDeleteErr}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setBatchDeleteOpen(false); setBatchConfirmInput('') }} disabled={batchDeleting}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors disabled:opacity-40">
                  Cancel
                </button>
                <button onClick={handleBatchDelete} disabled={batchDeleting || batchConfirmInput !== 'DELETE'}
                  className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-red-500 text-white hover:bg-red-600 disabled:opacity-30 flex items-center justify-center gap-2 transition-all">
                  {batchDeleting && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                  {batchDeleting ? 'Deleting...' : `Delete ${selectedUsers.length} User${selectedUsers.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
        )
      })()}

      {/* Add user modal */}
      {addModal && (
        <AddUserModal
          buildings={buildings as Building[]}
          locations={locations as Location[]}
          departments={departments as Department[]}
          onSave={handleAddUser}
          onClose={() => setAddModal(false)}
        />
      )}

      {/* Import / Export modal */}
      {importExportModal && (
        <ImportExportModal
          users={users as User[]}
          onImport={handleImport}
          onClose={() => setIEModal(false)}
        />
      )}

      {/* Edit user modal */}
      {editUser && (
        <ModalPortal>
        <div className="fixed inset-0 z-[1000] flex items-center justify-center admin-backdrop-in" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)' }} onClick={() => setEditUser(null)}>
          <div className="w-[540px] flex flex-col rounded-3xl shadow-2xl overflow-hidden admin-modal-in"
            style={{ height: 680, background: 'var(--ds-bg-surface)', backdropFilter: 'blur(48px) saturate(200%)', border: '1px solid rgba(128,128,128,0.15)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-7 pt-6 pb-5 border-b border-[var(--ds-border-sub)] shrink-0">
              <UserAvatar name={editUser.name} avatar={editUser.avatar} size={48}
                style={{ borderRadius: 16 }} />
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-[var(--ds-text-1)]">Edit User</h3>
                <p className="text-[10px] text-[var(--ds-text-3)]">{editUser.email}</p>
              </div>
            </div>

            {/* Scrollable body */}
            <div ref={editScrollBodyRef} className="flex-1 overflow-y-auto px-7 py-5 space-y-4" style={{ scrollbarWidth: 'thin' }}>

            {editErr && <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}><span className="material-symbols-outlined shrink-0" style={{ fontSize: 14 }}>error</span>{editErr}</div>}

            {/* Info fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Full Name *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Email *</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Username / Alias</label>
                <input value={editAlias} onChange={e => setEditAlias(e.target.value.toLowerCase())} placeholder="e.g. budi.santoso"
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Department</label>
                <select value={editDeptId ?? ''} onChange={e => setEditDeptId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] appearance-none cursor-pointer bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]">
                  <option value="">— No department —</option>
                  {(departments as Department[]).map(d => <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ''}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Ext (phone)</label>
                <input value={editExt} onChange={e => setEditExt(e.target.value)}
                  className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">New Password <span className="normal-case font-medium">(leave blank to keep)</span></label>
                <div className="relative">
                  <input type={editShowPw ? 'text' : 'password'} value={editPw} onChange={e => setEditPw(e.target.value)} placeholder="min. 8 characters"
                    className="w-full border border-[var(--ds-border)] rounded-xl px-3 py-2 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#adee2b] bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)]" />
                  <button type="button" onClick={() => setEditShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ds-text-3)] hover:text-[var(--ds-text-1)]">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{editShowPw ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
              {editPw && (
                <div className="col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase text-[var(--ds-text-3)] tracking-wider">Confirm New Password</label>
                  <div className="relative">
                    <input type={editShowPw ? 'text' : 'password'} value={editConfirmPw} onChange={e => setEditConfirmPw(e.target.value)} placeholder="Re-enter new password"
                      className={`w-full border rounded-xl px-3 py-2 pr-10 text-sm font-bold focus:outline-none focus:ring-2 bg-[var(--ds-bg-surface)] text-[var(--ds-text-1)] ${editConfirmPw && editConfirmPw !== editPw ? 'border-red-300 focus:ring-red-400' : editConfirmPw && editConfirmPw === editPw ? 'border-green-300 focus:ring-green-400' : 'border-[var(--ds-border)] focus:ring-[#adee2b]'}`} />
                  </div>
                  {editConfirmPw && editConfirmPw !== editPw && (
                    <p className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>error</span>Passwords do not match
                    </p>
                  )}
                  {editConfirmPw && editConfirmPw === editPw && (
                    <p className="flex items-center gap-1 text-[10px] text-green-600 font-bold">
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check_circle</span>Passwords match
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Role selector */}
            {(() => {
              const adminCount = (users as User[]).filter(u => u.role === 'admin').length
              const isLastAdmin = editUser?.role === 'admin' && adminCount <= 1
              return (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Role</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_ROLES.map(r => {
                      const m = ROLE_META[r]
                      const blocked = isLastAdmin && r !== 'admin'
                      return (
                        <div key={r} className="relative group/role">
                          <button
                            onClick={() => selectEditRole(r, blocked)}
                            disabled={blocked}
                            title={blocked ? 'Cannot demote the last Super Admin' : undefined}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all
                              ${blocked ? 'opacity-30 cursor-not-allowed bg-[var(--ds-bg-surface)] border-[var(--ds-border)] text-[var(--ds-text-3)]'
                                : roleValue === r ? `${m.bg} ${m.text} border-transparent`
                                : 'bg-[var(--ds-bg-surface)] border-[var(--ds-border)] text-[var(--ds-text-3)] hover:border-[var(--ds-border)]'}`}>
                            <span className={`size-2 rounded-full shrink-0 ${roleValue === r ? 'bg-current' : 'bg-slate-200'}`} />
                            <span className="flex-1 text-left">{m.label}</span>
                            {!blocked && <span className="size-3.5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 opacity-50 group-hover/role:opacity-100 transition-opacity"
                              style={{ background: 'rgba(128,128,128,0.15)', color: 'inherit' }}>i</span>}
                          </button>
                          {!blocked && (
                            <div className="absolute left-0 right-0 bottom-[calc(100%+8px)] z-[300] pointer-events-none opacity-0 translate-y-1 group-hover/role:opacity-100 group-hover/role:translate-y-0 transition-all duration-200">
                              <div className="rounded-2xl p-3.5 shadow-2xl space-y-2"
                                style={{ background: 'rgba(15,20,45,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
                                <p className="text-[10px] font-black" style={{ color: '#fff' }}>{m.label}</p>
                                <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{m.desc}</p>
                                <div className="pt-1.5 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                  {m.perms.map((p, i) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                      <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: 10, color: 'rgba(173,238,43,0.7)' }}>check</span>
                                      <span className="text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{p}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {isLastAdmin && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <span className="material-symbols-outlined text-amber-500 shrink-0 mt-0.5" style={{ fontSize: 14 }}>warning</span>
                      <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                        This is the only Super Admin. Promote another user to Super Admin before changing this role.
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Building assignment */}
            {roleValue === 'user' && (
              <DefaultBuildingSelect
                buildings={buildings as Building[]}
                value={editDefaultBldId}
                onChange={setEditDefaultBldId}
              />
            )}
            {(roleValue === 'building_admin' || roleValue === 'receptionist') && (
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-[var(--ds-text-3)]">Buildings</p>
                <BuildingPicker
                  role={roleValue}
                  bldIds={bldIds}
                  buildings={buildings as Building[]}
                  locations={locations as Location[]}
                  onToggle={toggleBuilding}
                  defaultBuildingId={editDefaultBldId}
                  onSetDefault={setEditDefaultBldId}
                />
              </div>
            )}

            </div>{/* end scrollable body */}

            {/* Footer — pinned */}
            <div className="px-7 py-5 border-t border-[var(--ds-border-sub)] shrink-0 flex gap-3">
              <button onClick={() => setEditUser(null)} className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-[var(--ds-bg-surface-2)] text-[var(--ds-text-2)] hover:bg-[var(--ds-bg-raised)] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || (roleValue === 'building_admin' && bldIds.length === 0)}
                className="flex-1 py-3.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] bg-black text-[#adee2b] hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-2 transition-all">
                {saving && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
                Save Changes
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  )
}

export { UsersTab as default }
