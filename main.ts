import { Hono } from 'hono'
import { stream } from 'hono/streaming'

import Handlebars from 'handlebars'

const template = Handlebars.compile(`
<html>
  <head>
    <meta property="og:title" content="{{char}} by {{creator}} ({{tokens}} tokens, {{likes}} likes)" />
    <meta property="og:description" content="{{description}}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://f56eacc3bae462cff9d32bbb6a10921e.serveo.net/images/{{creator}}/{{character}}.png" />
    <meta name="twitter:card" content="summary_large_image">
    <meta property="og:url" content="{{url}}" />
  </head>
</html>`)

const home = `
<html>
  <body>
    <h1>fxchub - enables discord embeds for chub cards</h1>
    <p>No logs are kept, see source at htttps://github.com/NyxKrage/fxchub</p>
    <form>
      <h2>Preferred Site, where fxchub will redirect you to</h2>
      <label>
        <input type="radio" name="site" value="chub.ai" onclick="setSiteCookie('chub.ai')" id="chub"> chub.ai
      </label>
      <label>
        <input type="radio" name="site" value="characterhub.org" onclick="setSiteCookie('characterhub.org')" id="characterhub"> characterhub.org
      </label>
    </form>
    <script>
      function setSiteCookie(site) {
        document.cookie = "preferredSite=" + site + "; path=/";
      }

      function getCookie(name) {
        return Object.fromEntries(document.cookie.split(";").map(ck => ck.split("=", 2).map(v => v.trim())))[name]
      }

      window.onload = function() {
        const preferredSite = getCookie('preferredSite') || 'chub.ai';
        document.getElementById(preferredSite === 'chub.ai' ? 'chub' : 'characterhub').checked = true;
      }
    </script>
  </body>
</html>
`

const app = new Hono()

app.get('/', (c) => {
  return c.html(home)
})

app.get('/characters/:creator/:character', async (c) => {
  let { creator, character } = c.req.param()
  character = character.replace(/\/$/, "")

  if (!c.req.header("User-Agent")?.includes("Discordbot")) {
    const preferredSite = Object.fromEntries(c.req.header("Cookie")?.split(";")?.map(ck => ck.split("=", 2).map(v => v.trim())) ?? [])["preferredSite"] ?? "chub.ai"
    const url = `https://${preferredSite}/characters/${creator}/${character}`
    return c.redirect(url)
  }

  const url = `https://chub.ai/characters/${creator}/${character}`
  const r = await fetch(`https://api.chub.ai/api/characters/${creator}/${character}?full=true`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0"
    }
  }).then(r => r.json())

  const html = template({
    url,
    char: r.node.name,
    creator,
    character,
    likes: r.node.n_favorites,
    description: r.node.tagline,
    tokens: JSON.parse(r.node.labels.find(label => label.title === "TOKEN_COUNTS").description).total
  })

  return c.html(html)
})

app.get("/images/:creator/:character", (c) => {
  let { creator, character } = c.req.param()
  character = character.replace(/\.[^/.]+$/, "");

  return stream(c, async (stream) => {
    const body = await fetch(`https://avatars.charhub.io/avatars/${creator}/${character}/chara_card_v2.png`).then(r => r.body)
    await stream.pipe(body!)
  })
})

export default app
