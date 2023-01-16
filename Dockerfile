FROM ubuntu:latest

RUN apt-get update
RUN apt-get -y upgrade

# Install requirements
RUN DEBIAN_FRONTEND=noninteractive apt-get -y install \
    apache2

# Enable apache mods.
RUN a2enmod rewrite

# Manually set up the apache environment variables
ENV APACHE_RUN_USER www-data
ENV APACHE_RUN_GROUP www-data
ENV APACHE_LOG_DIR /var/log/apache2
ENV APACHE_LOCK_DIR /var/lock/apache2
ENV APACHE_PID_FILE /var/run/apache2.pid

EXPOSE 80

RUN a2enmod deflate
RUN a2enmod headers
RUN /etc/init.d/apache2 restart

# Update the default apache site with the config we created.
ADD build/apache-config.conf /etc/apache2/sites-enabled/000-default.conf

# By default, simply start apache.
CMD /usr/sbin/apache2ctl -D FOREGROUND
