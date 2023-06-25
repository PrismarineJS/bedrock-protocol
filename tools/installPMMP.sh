rm -fr pmmp
mkdir pmmp && cd pmmp
wget https://github.com/pmmp/PHP-Binaries/releases/download/php-8.1-latest/PHP-Linux-x86_64-PM5.tar.gz
tar -xvf PHP-Linux-x86_64-PM5.tar.gz bin/
git clone https://github.com/pmmp/PocketMine-MP.git
cd PocketMine-MP
../bin/php7/bin/php /usr/bin/composer install
../bin/php7/bin/php src/PocketMine.php --no-wizard --xbox-auth=0 --settings.enable-dev-builds=1 --anonymous-statistics.enabled=0 --disable-readline --debug.level=2 