import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
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
  // 不能把主题并入自己的后代，否则子主题迁移后会形成父子环
  const descendantsOf = (rootId: string): Set<string> => {
    const result = new Set<string>([rootId]);
    let added = true;
    while (added) {
      added = false;
      props.store.state.themes.forEach((theme) => {
        if (theme.parentId && result.has(theme.parentId) && !result.has(theme.id)) {
          result.add(theme.id);
          added = true;
        }
      });
    }
    return result;
  };
  const candidates = createMemo(() => {
    const forbidden = source() ? descendantsOf(source()!.id) : new Set<string>();
    return props.store.orderedThemes().filter((theme) => !forbidden.has(theme.id));
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
        <div class="warning-box">合并后，来源主题的片段编码、子主题会迁移到目标主题，原主题被删除；来源主题的操作定义、研究备忘录会追加进目标主题（保留来源标注），典型示例并入目标主题，重复示例只保留一条。此操作可通过撤销恢复。</div>
        <div class="merge-route"><strong>{source()?.name ?? '未选择'}</strong><span>→</span><select class="native-select" value={target()} onChange={(event) => setTarget(event.currentTarget.value)}><option value="">选择目标主题</option><For each={candidates()}>{(theme) => <option value={theme.id}>{theme.name}</option>}</For></select></div>
        <footer><button class="button secondary" onClick={props.onClose}>取消</button><button class="button danger" disabled={!target()} onClick={submit}>确认合并</button></footer>
      </section>
    </div>
  );
}

export function SplitThemeDialog(props: { store: Store; open: boolean; onClose: () => void }) {
  const [name, setName] = createSignal('');
  const [selected, setSelected] = createSignal<string[]>([]);
  const [selectedExamples, setSelectedExamples] = createSignal<number[]>([]);
  const source = () => props.store.state.themes.find((theme) => theme.id === props.store.state.activeThemeId);
  const affected = createMemo(() => props.store.state.segments.filter((segment) => source() && (segment.assignments.A.includes(source()!.id) || segment.assignments.B.includes(source()!.id))));
  // 每次重新打开对话框（或切换来源主题）时清空勾选
  createEffect(() => {
    void props.open;
    void source()?.id;
    setName('');
    setSelected([]);
    setSelectedExamples([]);
  });
  const submit = () => {
    if (source() && name().trim() && selected().length) {
      props.store.splitTheme(source()!.id, name().trim(), selected(), selectedExamples());
    }
    setName(''); setSelected([]); setSelectedExamples([]);
    props.onClose();
  };
  return (
    <div class="modal-backdrop" classList={{ hidden: !props.open }} onClick={props.onClose}>
      <section class="modal-card wide" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header><div><span class="eyebrow">SPLIT</span><h2>从“{source()?.name}”拆分新主题</h2></div><button class="modal-close" onClick={props.onClose}>×</button></header>
        <p class="modal-intro">选择要迁入新主题的片段，其余片段继续保留在原主题。所有编码者的判断会一并迁移；勾选的典型示例会跟着新主题走，未勾选的留在原主题。</p>
        <label class="field-label">新主题名称<input class="native-input full" value={name()} onInput={(event) => setName(event.currentTarget.value)} placeholder="输入更具体的主题名称" /></label>
        <Show when={source()?.examples.length} fallback={<div class="muted">原主题暂无典型示例，拆分后可在新主题中补充。</div>}>
          <div class="field-label">随新主题迁出的典型示例
            <div class="split-list compact">
              <For each={source()!.examples}>{(exampleText, index) => (
                <label class="split-item"><input type="checkbox" checked={selectedExamples().includes(index())} onChange={(event) => setSelectedExamples((items) => event.currentTarget.checked ? [...items, index()] : items.filter((item) => item !== index()))} /><span><small>{exampleText}</small></span></label>
              )}</For>
            </div>
          </div>
        </Show>
        <div class="field-label">迁入新主题的片段
          <div class="split-list">
            <For each={affected()} fallback={<div class="empty-state">当前主题还没有可拆分的片段。</div>}>{(segment) => (
              <label class="split-item"><input type="checkbox" checked={selected().includes(segment.id)} onChange={(event) => setSelected((items) => event.currentTarget.checked ? [...items, segment.id] : items.filter((id) => id !== segment.id))} /><span>{segment.time} · {segment.speaker}<small>{segment.text}</small></span></label>
            )}</For>
          </div>
        </div>
        <footer><button class="button secondary" onClick={props.onClose}>取消</button><button class="button primary" disabled={!name().trim() || !selected().length} onClick={submit}>拆分主题</button></footer>
      </section>
    </div>
  );
}
