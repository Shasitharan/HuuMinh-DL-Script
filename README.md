# HuuMinh DL Script
HuuMinh DL Script is script generator premium link that allows you to download files instantly and at the best of your Internet speed
> Version: **0.0.1**\
> Copyright: **HuuMinh Technologies**\
> Author: **Nguyen Minh**\
> Homepage: **https://huuminh.net** \
> Support: **https://huuminh.net/contact-us/**

##Usage
1. `npm install -g huuminh-dl`
2. `huuminh-dl setup`
3. `huuminh-dl start`

##Configuration
You can configure the application using `~/.config/.huuminh-dl.conf`
```json
{
    "port": 3000,
    "url": "http://localhost:3000",
    "secret": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "autoupdate": true,
    "database": "redis",
    "redis": {
        "host": "127.0.0.1",
        "port": "27017",
        "database": 1
    }
}
```
