% Checkpassword SOAP service  
% Fabrice Le Coz  
% February 2015

This little site is used to control the login/password fill-up by the user on the IDS platform.
 
This site is requested through the IP given by the IDS platform ( VPN on test )

So if the ip change the service must mutch this ip, to generate the correct wsdl.

# Install

install the project in `/home/http/SOAPservice`

    git clone git@git.telecomsante.com:physiodom-hdim/SOAPservice.git /home/http/SOAPservice

Create a config file in `/home/http/` using the `config.json.sample`

    cp /home/http/SOAPservice/config.json.sample /home/http/SOAPservice.json

edit the file to set the correct IP, in dev mode the IP is the IP given by the VPN with the IDS platform.

copy the init.d file and register the service, it will be better if the service starts before the HHR-pro instance

    sudo cp /home/http/SOAPservice/install/SOAPservice /etc/init.d
    sudo update-rc.d SOAPservice defaults 40