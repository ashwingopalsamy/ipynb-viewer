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
</script>

<Pop id="privacy" label="Privacy" width={344} lead={false} anchor={() => document.querySelector('[data-pop=settings]') ?? document.querySelector('.bar')}>
  {#if open}
    <div class="set">
      <div class="set-count" aria-live="polite">
        <b>{others.length}</b>
        <span>{others.length === 1 ? 'request' : 'requests'} to other sites since the notebook opened{net.name ? '' : ' (none is open yet)'}</span>
      </div>

      <div class="set-group">
        <div class="set-kv"><span>Offline copy</span><b>{offline}</b></div>
        <div class="set-kv"><span>Connections</span><b>{net.lock ? 'Closed' : 'Opens shut'}</b></div>
        <div class="set-kv"><span>Web pictures</span><b>{web}</b></div>
        {#if sent.length}
          <button class="sw" aria-expanded={list} onclick={() => (list = !list)}>
            <span>{list ? 'Hide' : 'Show'} {sent.length} {sent.length === 1 ? 'request' : 'requests'}</span>
            <Glyph name="chev" />
          </button>
        {/if}
      </div>

      {#if list}
        <ul class="set-ledger rise">
          {#each [...others, ...sent.filter((s) => s.host === location.host)] as s}<li><b>{s.host}</b><span>{s.path}</span></li>{/each}
        </ul>
      {/if}

      {#if net.hosts.length}<p class="set-note">{net.pictures} from {sites(net.hosts)}.{net.blocked.length ? ` ${net.blocked.length} stopped by the browser.` : ''}</p>{/if}
      {#if own}<p class="set-note">{own} {own === 1 ? 'file' : 'files'} came from this app's own server, as on a first visit. Once the offline copy is ready, a notebook asks for none.</p>{/if}

      <div class="pills">
        <button onclick={() => (forget(), (cleared = true))} disabled={cleared}><Icon name="history" />{cleared ? 'Forgotten' : 'Forget choices'}</button>
        <a href={new URL('./', document.baseURI).href}><Icon name="house" />How this works</a>
      </div>
    </div>
  {/if}
</Pop>
