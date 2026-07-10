FROM php:8.2-apache

RUN apt-get update && apt-get install -y \
    libzip-dev zip unzip libpng-dev libonig-dev \
    && docker-php-ext-install pdo_mysql mbstring zip gd

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY . .

RUN composer install --no-dev --optimize-autoloader

RUN a2enmod rewrite
RUN echo '<Directory /var/www/html/public>\n    AllowOverride All\n</Directory>' \
    >> /etc/apache2/apache2.conf

RUN chown -R www-data:www-data storage bootstrap/cache

ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
    /etc/apache2/sites-available/*.conf

EXPOSE 80

CMD php artisan config:cache && (php artisan storage:link || true) && chown -R www-data:www-data storage bootstrap/cache && php artisan migrate --force && apache2-foreground
