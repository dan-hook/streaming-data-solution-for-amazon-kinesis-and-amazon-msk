# See here for image contents: https://github.com/microsoft/vscode-dev-containers/tree/v0.245.0/containers/ubuntu/.devcontainer/base.Dockerfile

# [Choice] Ubuntu version (use ubuntu-22.04 or ubuntu-18.04 on local arm64/Apple Silicon): ubuntu-22.04, ubuntu-20.04, ubuntu-18.04
FROM jsii/superchain:1-buster-slim-node16

# [Optional] Uncomment this section to install additional OS packages.
#RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#    && apt-get -y install --no-install-recommends python3.9-venv

ARG USERNAME=superchain
ARG USER_UID
RUN echo "export HOST_UID=$USER_UID\nexport HOST_GID=$USER_UID\n" >> /home/superchain/.bash_profile

RUN echo $(whoami)

#RUN groupmod --gid $USER_UID $USERNAME \
#    && usermod --uid $USER_UID --gid $USER_UID $USERNAME \
#    && chown -R $USER_UID:$USER_UID /home/$USERNAME

USER superchain
RUN mkdir -p /home/$USERNAME/.config