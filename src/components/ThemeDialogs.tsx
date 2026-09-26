import { For, Show, createMemo, createSignal } from 'solid-js';
import type { useCodingStore } from '../store/coding-store';

type Store = ReturnType<typeof useCodingStore>;

export function CreateThemeDialog(props: { store: Store; open: boolean; parentId?: string; onClose: () => void }) {
  const [name, setName] = createSignal('');
  const parent = () => props.store.state.themes.find((theme) => theme.id === props.parentId);
  const submit = () => {
    if (!name().trim()) return;
    props.store.addTheme(name().trim(), props.parentId ?? null);
    setName('');
    props.onClose();
  };
  return (
    <div class="modal-backdrop" classList={{ hidden: !props.open }} onClick={props.onClose}>
      <section class="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span class="eyebrow">THEME</span><h2>{parent() ? '添加子主题' : '创建一级主题'}</h2></div><button class="modal-close" onClick={props.onClose}>×</button></header>
        <Show when={parent()}><p class="modal-intro">父主题：<strong>{parent()!.name}</strong></p></Show>
        <label class="field-label">主题名称<input autofocus class="native-input full" value={name()} onInput={(event) => setName(event.currentTarget.value)} onKeyDown={(event) => event.key === 'Enter' && submit()} placeholder="例如：教育中断" /></label>
        <footer><button class="button secondary" onClick={props.onClose}>取消</button><button class="button primary" disabled={!name().trim()} onClick={submit}>创建主题</button></footer>
      </section>
    </div>
  );
}

export function MergeThemeDialog(props: { store: Store; open: boolean; onClose: () => void }) {
  const [target, setTarget] = createSignal('');
  const source = () => props.store.state.themes.find((theme) => theme.id === props.store.state.activeThemeId);
  const targetTheme = () => props.store.state.themes.find((theme) => theme.id === target());
  const candidates = createMemo(() => props.store.orderedThemes().filter((theme) => theme.id !== source()?.id));
  const sourceMeta = createMemo(() => {
    const current = source();
    if (!current) return '';
    const parts = [
      current.definition.trim() ? '操作定义' : '',
      current.memo.trim() ? '研究备忘录' : '',
      current.examples.length ? `示例 ${current.examples.length} 条` : ''
    ].filter(Boolean);
    return parts.length ? parts.join('、') : '无文字资料';
  });
  const duplicateExamples = createMemo(() => {
    const from = source();
    const to = targetTheme();
    if (!from || !to) return 0;
    return from.examples.filter((example) => to.examples.includes(example)).length;
  });
  const submit = () => {
    if (source() && target()) props.store.mergeThemes(source()!.id, target());
    setTarget(() => '');
    props.onClose();
  };
  return (
    <div class="modal-backdrop" classList={{ hidden: !props.open }} onClick={props.onClose}>
      <section class="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span class="eyebrow">MERGE</span><h2>合并主题</h2></div><button class="modal-close" onClick={props.onClose}>×</button></header>
        <div class="warning-box">合并后，来源主题的片段编码、子主题、操作定义、研究备忘录与典型示例都会并入目标主题，原主题被删除；内容完全相同的示例只保留一条。此操作可通过撤销恢复。</div>
        <div class="merge-route"><strong>{source()?.name ?? '未选择'}</strong><span>→</span><select class="native-select" value={target()} onChange={(event) => setTarget(event.currentTarget.value)}><option value="">选择目标主题</option><For each={candidates()}>{(theme) => <option value={theme.id}>{theme.name}</option>}</For></select></div>
        <Show when={source()}>
          <p class="modal-intro">将并入目标主题的资料：{sourceMeta()}{duplicateExamples() ? `；其中 ${duplicateExamples()} 条示例与目标重复，合并后只留一条` : ''}。</p>
        </Show>
        <footer><button class="button secondary" onClick={props.onClose}>取消</button><button class="button danger" disabled={!target()} onClick={submit}>确认合并</button></footer>
      </section>
    </div>
  );
}

export function SplitThemeDialog(props: { store: Store; open: boolean; onClose: () => void }) {
  const [name, setName] = createSignal('');
  const [selected, setSelected] = createSignal<string[]>([]);
  const [pickedExamples, setPickedExamples] = createSignal<string[]>([]);
  const source = () => props.store.state.themes.find((theme) => theme.id === props.store.state.activeThemeId);
  const affected = createMemo(() => props.store.state.segments.filter((segment) => source() && (segment.assignments.A.includes(source()!.id) || segment.assignments.B.includes(source()!.id))));
  const canSubmit = () => Boolean(name().trim()) && (selected().length > 0 || pickedExamples().length > 0);
  const toggleExample = (example: string, checked: boolean) => setPickedExamples((items) => checked ? [...items, example] : items.filter((item) => item !== example));
  const submit = () => {
    if (source() && canSubmit()) props.store.splitTheme(source()!.id, name().trim(), selected(), pickedExamples());
    setName(''); setSelected([]); setPickedExamples([]);
    props.onClose();
  };
  return (
    <div class="modal-backdrop" classList={{ hidden: !props.open }} onClick={props.onClose}>
      <section class="modal-card wide" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span class="eyebrow">SPLIT</span><h2>从“{source()?.name}”拆分新主题</h2></div><button class="modal-close" onClick={props.onClose}>×</button></header>
        <p class="modal-intro">选择要迁入新主题的片段与典型示例，其余内容继续保留在原主题。所有编码者的判断会一并迁移，未勾选的示例留在原主题。</p>
        <label class="field-label">新主题名称<input class="native-input full" value={name()} onInput={(event) => setName(event.currentTarget.value)} placeholder="输入更具体的主题名称" /></label>
        <div class="split-heading">迁入新主题的片段 <span>{selected().length} / {affected().length}</span></div>
        <div class="split-list">
          <For each={affected()} fallback={<div class="empty-state">当前主题还没有可拆分的片段。</div>}>{(segment) => (
            <label class="split-item"><input type="checkbox" checked={selected().includes(segment.id)} onChange={(event) => setSelected((items) => event.currentTarget.checked ? [...items, segment.id] : items.filter((id) => id !== segment.id))} /><span>{segment.time} · {segment.speaker}<small>{segment.text}</small></span></label>
          )}</For>
        </div>
        <div class="split-heading">迁入新主题的示例 <span>{pickedExamples().length} / {source()?.examples.length ?? 0}</span></div>
        <div class="split-list">
          <For each={source()?.examples ?? []} fallback={<div class="empty-state">当前主题还没有示例。</div>}>{(example) => (
            <label class="split-item"><input type="checkbox" checked={pickedExamples().includes(example)} onChange={(event) => toggleExample(example, event.currentTarget.checked)} /><span>{example}</span></label>
          )}</For>
        </div>
        <footer><button class="button secondary" onClick={props.onClose}>取消</button><button class="button primary" disabled={!canSubmit()} onClick={submit}>拆分主题</button></footer>
      </section>
    </div>
  );
}
