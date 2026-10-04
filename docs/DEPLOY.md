# Put WorkPulseLens live on workpulselens.com

WorkPulseLens runs on one small Linux server with Docker. Caddy sits in front of the app and gets free HTTPS certificates automatically, and renews them on its own: for `workpulselens.com`, `www.workpulselens.com`, and each company workspace such as `google.workpulselens.com` the first time someone opens it.

You do three things: create a server, point the domain at it, and run one command on it. Everything below works from the Mac Terminal app.

## 1. Create a server

Any provider works. Pick **Ubuntu 24.04** and at least **4 GB of memory** (2 GB works too; the deploy script adds swap, but the first build is slow). For example:

- **Hetzner Cloud**: a CX22 server (2 vCPU, 4 GB).
- **DigitalOcean**: a Basic Droplet with 4 GB.
- **AWS Lightsail**: the 4 GB Linux instance. In its *Networking* tab, add HTTPS (443) to the firewall.

When it asks how to log in, choose **SSH key**. If you don't have one yet, make it on your Mac and copy the public key, then paste it into the provider's "Add SSH key" box:

```sh
ssh-keygen -t ed25519            # press Enter at every question
pbcopy < ~/.ssh/id_ed25519.pub   # the public key is now on your clipboard
```

Write down the server's **public IPv4 address** (for example `203.0.113.10`).

## 2. Point workpulselens.com at the server (GoDaddy)

Don't use GoDaddy's website builder: WorkPulseLens is its own website, so only the DNS records matter.

1. Go to <https://dcc.godaddy.com/control/portfolio>, click **workpulselens.com**, then **DNS**.
2. Find the record with **Type A** and **Name @**. Click the pencil, set **Value** to your server's IP, TTL to 1/2 hour, and save.
   If GoDaddy says the record is used by Website Builder (or the record is locked), first unpublish the site in Website Builder (*Settings → Unpublish site*), then edit the record.
3. Find the record with **Name www**:
   - If it's a **CNAME** pointing to `@` or `workpulselens.com`, leave it.
   - Otherwise delete it and add **Type A, Name www, Value** your server's IP.
4. Delete any other **A** or **AAAA** records for `@` or `www` that point somewhere else (for example to GoDaddy's "Parked" page).
5. For company workspaces, click **Add New Record** and add **Type A, Name `*`** (just an asterisk), **Value** your server's IP, TTL 1/2 hour, and save. This sends every `<company>.workpulselens.com` to the server.

DNS changes usually show up within minutes, sometimes up to an hour. Check from your Mac:

```sh
dig +short workpulselens.com
dig +short www.workpulselens.com
dig +short anything.workpulselens.com
```

All three should print your server's IP.

## 3. Deploy

From your Mac, log in to the server (use `ubuntu@` instead of `root@` on Lightsail):

```sh
ssh root@YOUR_SERVER_IP
```

On the server:

```sh
git clone https://github.com/aithalvishwas/daily-update-website.git
cd daily-update-website
sudo ./config/deploy.sh workpulselens.com vishwas@workpulselens.com
```

The second part is the email you'll sign in with as the admin. If you leave it out, it's `vishwas@workpulselens.com`.

The script installs Docker, opens only SSH, HTTP and HTTPS in the firewall, creates `config/.env` with strong random passwords, builds the app and starts it. The first build takes several minutes. At the end it prints the admin and manager logins: save them somewhere safe.

Open <https://workpulselens.com>: that's the public site, where companies sign up and get their own workspace. Your existing data and the admin and manager accounts are in the default workspace at <https://app.workpulselens.com>; sign in there as the admin. On the **Accounts** page you can add people and give each one a role (employee, manager or admin), change anyone's role later with **Edit**, and change the manager login's email to a real one.

To add Ram as an employee: on **Accounts**, choose **Add account**, enter name *Ram* and email `ram@workpulselens.com`, leave access on **Employee**, and save. Give Ram the temporary password it shows; Ram signs in at <https://app.workpulselens.com>.

For AI summaries, add your key on the server (never paste it in chat or commit it), then run the deploy again:

```sh
nano config/.env      # set ANTHROPIC_API_KEY=..., then Ctrl+O, Enter, Ctrl+X
sudo ./config/deploy.sh
```

## Updating

```sh
ssh root@YOUR_SERVER_IP
cd daily-update-website
git pull
sudo ./config/deploy.sh
```

Your data lives in Docker volumes and survives updates and restarts.

## When something is wrong

```sh
cd daily-update-website
docker compose -f config/docker-compose.yml -f config/docker-compose.prod.yml ps        # what's running
docker compose -f config/docker-compose.yml -f config/docker-compose.prod.yml logs caddy  # HTTPS problems
```

- **The browser shows a certificate warning or can't connect**: DNS doesn't point to the server yet. Check `dig +short workpulselens.com`; Caddy retries on its own once it does.
- **A company workspace can't connect, but workpulselens.com works**: the `*` record from step 2 is missing (check `dig +short google.workpulselens.com`), or no company has signed up with that address. Caddy only gets certificates for workspaces that exist.
- **You still see the GoDaddy page**: an old A record or the website builder is still active, see step 2.

## Backups

Save a copy of the database to your Mac now and then:

```sh
ssh root@YOUR_SERVER_IP 'cd daily-update-website && docker compose -f config/docker-compose.yml exec -T db sh -c "pg_dump -U \$POSTGRES_USER \$POSTGRES_DB"' > workpulselens-$(date +%F).sql
```
