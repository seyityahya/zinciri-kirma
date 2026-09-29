/**
 * Proje klasörünün adında ASCII olmayan bir karakter var ("zinciri-kırma").
 * CocoaPods, çalıştırdığı komutların çıktısını ikili (ASCII-8BIT) kodlamayla okur;
 * yol "ı" içerdiğinde hermes-engine.podspec gibi dosyalar "incompatible character
 * encodings" hatasıyla durur. Bu eklenti Podfile'ın başına, çıktıyı UTF-8 olarak
 * işaretleyen küçük bir yama ekler.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# [zinciri-kirma] utf8-podfile';

const PATCH = `${MARKER}
Encoding.default_external = Encoding::UTF_8
::Pod::Executable.singleton_class.class_eval do
  unless method_defined?(:zk_execute_command_without_utf8)
    alias_method :zk_execute_command_without_utf8, :execute_command
    define_method(:execute_command) do |*args|
      output = zk_execute_command_without_utf8(*args)
      output.is_a?(String) ? output.dup.force_encoding(Encoding::UTF_8) : output
    end
  end
end
# [zinciri-kirma] end
`;

module.exports = function withUtf8Podfile(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        fs.writeFileSync(podfile, `${PATCH}\n${contents}`);
      }
      return cfg;
    },
  ]);
};
