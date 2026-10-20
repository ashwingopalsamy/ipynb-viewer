<script lang="ts">
  import Pop from './Pop.svelte';
  import Icon from './Lucide.svelte';
  import Glyph from './Icon.svelte';
  import { net, sites, forget } from './netstate.svelte';
  import { ui } from './ui.svelte';
  import './panel.css';
  import './net.css';
  import './settings.css';

  // The count comes from the browser's own log of requests the page made, so it can be checked in the developer tools too.
  const sent = $derived(net.seen.filter((s) => !s.local));
  const others = $derived(sent.filter((s) => s.host !== location.host));
  const own = $derived(sent.length - others.length);
  const open = $derived(ui.pop === 'privacy');
  let cleared = $state(false);
  let list = $state(false);

  // The worker only becomes active once it holds every file, so "active" is the whole answer.
  let offline = $state('Checking');
  $effect(() => {
    if (!open) return;
    const sw = navigator.serviceWorker;
    if (!sw) return void (offline = 'Not in this browser');
    sw.getRegistration().then((r) => (offline = r?.active ? 'Ready' : r ? 'Getting ready' : 'Not yet'));
  });
  const web = $derived(
    !net.name ? 'Asked per notebook' : net.choice === 'none' ? 'None needed' : net.choice === 'loaded' ? 'Loaded' : net.choice === 'ask' ? 'Waiting for you' : 'Blocked',
  );
  type Tone = 'ok' | 'on' | 'wait' | 'busy' | 'off';
  const offTone = $derived<Tone>(offline === 'Ready' ? 'ok' : offline === 'Checking' || offline === 'Getting ready' ? 'busy' : 'off');
  const webTone = $derived<Tone>(!net.name ? 'off' : net.choice === 'loaded' ? 'on' : net.choice === 'ask' ? 'wait' : 'ok');
  // A long address loses its middle: the folder gives way first, the file name stays.
  const split = (p: string) => {
    const i = p.lastIndexOf('/', p.length - 2) + 1;
    return [p.slice(0, i), p.slice(i)];
  };
</script>

<Pop id="privacy" label="Privacy" width={344} lead={false} anchor={() => document.querySelector('[data-pop=settings]') ?? document.querySelector('.bar')}>
  {#if open}
    <div class="set">
      <div class="stat" aria-live="polite">
        {#key others.length}<b class="roll">{others.length}</b>{/key}
        <span>{others.length === 1 ? 'Request' : 'Requests'} to other sites</span>
        <small>{net.name ? 'Since the notebook opened' : 'No notebook is open yet'}</small>
      </div>

      <div class="set-group">
        <div class="set-kv"><Icon name="wifi-off" /><span>Offline copy</span><span class="st" data-s={offTone}>{offline}</span></div>
        <div class="set-kv"><Icon name="lock" /><span>Connections</span><span class="st" data-s={net.lock ? 'ok' : 'off'}>{net.lock ? 'Closed' : 'Opens shut'}</span></div>
        <div class="set-kv"><Icon name="image" /><span>Web pictures</span><span class="st" data-s={webTone}>{web}</span></div>
        {#if sent.length}
          <button class="sw" aria-expanded={list} onclick={() => (list = !list)}>
            <Icon name="list" />
            <span>{list ? 'Hide' : 'Show'} {sent.length} {sent.length === 1 ? 'request' : 'requests'}</span>
            <Glyph name="chev" />
          </button>
          {#if list}
            <ul class="set-ledger rise">
              {#each [...others, ...sent.filter((s) => s.host === location.host)] as s}
                {@const [dir, base] = split(s.path)}
                <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                <li tabindex="0" title="{s.host}{s.path}"><b>{s.host}</b><span class="dir">{dir}</span><span class="base">{base}</span></li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>

      {#if net.hosts.length}<p class="set-note">{net.pictures} from {sites(net.hosts)}.{net.blocked.length ? ` ${net.blocked.length} stopped by the browser.` : ''}</p>{/if}
      {#if own}<p class="set-note">{own} {own === 1 ? 'file' : 'files'} came from this app's own server, as on a first visit. Once the offline copy is ready, a notebook asks for none.</p>{/if}

      <div class="set-foot">
        <button class="btn quiet" class:done={cleared} onclick={() => (forget(), (cleared = true))} disabled={cleared}><span class="ico-swap"><Icon name="history" /><Icon name="check" /></span>{cleared ? 'Forgotten' : 'Forget choices'}</button>
        <a class="btn quiet" href={new URL('privacy/', document.baseURI).href} target="_blank" rel="noopener"><Icon name="arrow-up-right" />How this works</a>
      </div>
    </div>
  {/if}
</Pop>
