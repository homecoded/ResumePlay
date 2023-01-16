# ResumePlay

Repository for resumeplay.lazerbahn.com
This is a simple helper tool for listening/viewing long YouTube videos. 

## Why did I build this?

### Problem: 

I like to listen to audiobooks on YouTube in my browser (FireFox with uBlock). Of course, I'm not always 
able to listen to all the 8 hours of Tolstoy in one go, so I stop the video and come back later. My browser sometimes
forgets the play position and I have to search for the timestamp to resume.

### Solution: 

"I" built a little web app that would play a YouTube video. It stores the play position while playing in
LocalStorage and whenever I go back to the page my video resumes where I've left off. 

### Development process

The project was an experiment. Most of the code was written by the AI called "ChatGPT". Even the name of the applicatiom
was invented by CharGPT. The AI was not able to churn out a complete web application that was to my liking. 
Yet, I was able to turn the Ai output into something I liked with relatively little effort.

## Developmemnt Setup

It's completely build on Docker. For simplicity, all Docker interactivity is encapsulated in shell scripts:

    ./up.sh         # build container and start it (--rebuild to re-create it) 
    ./down.sh       # stop container and delete it
    ./shell.sh      # open shell into container

To expose the docker container on a custom port other than 80, copy `.env.dist` to `.env` and change the
`LOCAL_PORT` variable.
