% Checkpassword SOAP service  
% Fabrice Le Coz  
% February 2015

This service is used to control the login/password fill-up by the user on the IDS platform. and so depends of the hosting platform.
 
This site is requested through the IP given by the IDS platform ( VPN on test )

So if the ip change the service must match this ip, to generate the correct wsdl.

![](physiodom.png)

# Install

Create a config file named `config.json` in a directory that will be shared to the constainer.

    {
      "serverIP":"10.29.144.2"   <-- IP of the platform into the IDS network
    }

The container need to connect to an etcd service, where HHR-Pro instances are registered.

Then run the container :

    docker run -d --restart=always \
           --name SOAPservice \
           -v /opt/config/SOAP:/config \
           -v /opt/logs/SOAP:/logs
           --link etcd:etcd
           SOAPservice:x.y.z